import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { sendPushToOwner } from "@/lib/integrations/push";
import {
  CONSENT_COPY_VERSION,
  CONSENT_STOP_TTL_DAYS,
  CONSENT_TOKEN_PATTERN,
  RECIPIENT_COLUMNS,
  firstNameOf,
  firstRecipientCallTime,
  hashConsentToken,
  maskPhone,
  type CareRecipient,
} from "@/lib/care-recipient";

/**
 * The service-role half of "check in on someone you care for". The person agreeing has no
 * account, so the agreement page and the voice agent's stop tool both work through here with RLS
 * bypassed; each function re-derives what the caller may learn or change from the token or the
 * live call instead of trusting the request.
 */

export type ConsentPreview =
  | { status: "invalid" }
  | {
      status: "pending" | "expired" | "granted" | "declined" | "revoked";
      recipientFirstName: string;
      ownerFirstName: string;
      planTitle: string;
      phoneMasked: string;
    };

async function loadByToken(token: string) {
  if (!CONSENT_TOKEN_PATTERN.test(token)) return null;
  const admin = getSupabaseAdminClient();
  const { data: recipient } = await admin
    .from("nura_care_recipients")
    .select(`${RECIPIENT_COLUMNS}, created_at`)
    .eq("consent_token_hash", hashConsentToken(token))
    .maybeSingle();
  if (!recipient) return null;

  const [{ data: plan }, { data: profile }] = await Promise.all([
    admin.from("nura_plans").select("id, title").eq("id", recipient.plan_id).maybeSingle(),
    admin.from("nura_profiles").select("display_name").eq("id", recipient.owner_id).maybeSingle(),
  ]);
  if (!plan) return null;

  return {
    admin,
    recipient: recipient as CareRecipient & { created_at: string },
    planTitle: plan.title as string,
    ownerFirstName: firstNameOf(profile?.display_name as string | null, "Someone"),
  };
}

function stopLinkStillValid(recipient: CareRecipient & { created_at: string }) {
  return Date.now() - new Date(recipient.created_at).getTime() < CONSENT_STOP_TTL_DAYS * 24 * 60 * 60_000;
}

export async function previewConsent(token: string): Promise<ConsentPreview> {
  const loaded = await loadByToken(token);
  if (!loaded || !stopLinkStillValid(loaded.recipient)) return { status: "invalid" };
  const { recipient, planTitle, ownerFirstName } = loaded;
  const base = {
    recipientFirstName: recipient.first_name,
    ownerFirstName,
    planTitle,
    phoneMasked: maskPhone(recipient.phone),
  };
  if (recipient.consent_status === "pending") {
    const expired = recipient.consent_expires_at && new Date(recipient.consent_expires_at).getTime() < Date.now();
    return { status: expired ? "expired" : "pending", ...base };
  }
  return { status: recipient.consent_status, ...base };
}

async function notifyOwner(admin: SupabaseClient, recipient: CareRecipient, body: string, pushTitle: string) {
  try {
    await admin
      .from("nura_messages")
      .insert({ owner_id: recipient.owner_id, plan_id: recipient.plan_id, role: "assistant", content: body });
  } catch {
    // The push below still tells them.
  }
  await sendPushToOwner(recipient.owner_id, {
    title: pushTitle,
    body,
    url: `/plans/${recipient.plan_id}`,
  }).catch(() => null);
}

/** Books the first call to the person, at a sensible hour where they are. */
export async function scheduleFirstRecipientCheckIn(admin: SupabaseClient, recipient: CareRecipient, planTitle: string) {
  const { count } = await admin
    .from("nura_check_ins")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", recipient.plan_id)
    .is("completed_at", null)
    .is("triggered_at", null);
  if ((count ?? 0) > 0) return;

  await admin.from("nura_check_ins").insert({
    owner_id: recipient.owner_id,
    plan_id: recipient.plan_id,
    channel: "voice",
    prompt:
      recipient.first_checkin_prompt ||
      `Introduce yourself, then gently ask ${recipient.first_name} how things are going with ${planTitle}.`,
    scheduled_for: firstRecipientCallTime(new Date(), recipient.time_zone).toISOString(),
    contact_phone: recipient.phone,
  });
}

/** Cancels every check-in still waiting to go out for this plan - nothing more will ring. */
async function cancelOpenCheckIns(admin: SupabaseClient, planId: string, reason: string) {
  await admin
    .from("nura_check_ins")
    .update({ triggered_at: new Date().toISOString(), call_status: "cancelled_no_consent", call_error: reason })
    .eq("plan_id", planId)
    .is("completed_at", null)
    .is("triggered_at", null);
  await admin
    .from("nura_check_ins")
    .update({ call_status: "cancelled_no_consent", call_error: reason, redial_at: null })
    .eq("plan_id", planId)
    .eq("call_status", "redial_pending");
}

export type ConsentDecision = "yes" | "no" | "stop";

export type ConsentResult =
  | { ok: true; status: "granted" | "declined" | "revoked" }
  | { ok: false; reason: "invalid" | "expired" };

/** The person's own answer from the agreement page. */
export async function respondToConsent(
  token: string,
  decision: ConsentDecision,
  evidence: { userAgent: string | null },
): Promise<ConsentResult> {
  const loaded = await loadByToken(token);
  if (!loaded || !stopLinkStillValid(loaded.recipient)) return { ok: false, reason: "invalid" };
  const { admin, recipient, planTitle } = loaded;
  const now = new Date().toISOString();

  if (decision === "stop") {
    if (recipient.consent_status !== "revoked") {
      await admin
        .from("nura_care_recipients")
        .update({ consent_status: "revoked", revoked_at: now, revoke_reason: "link" })
        .eq("id", recipient.id);
      await cancelOpenCheckIns(admin, recipient.plan_id, `${recipient.first_name} stopped the calls from their link.`);
      await notifyOwner(
        admin,
        recipient,
        `${recipient.first_name} has asked Nura to stop calling about "${planTitle}", so the calls have stopped. You can still keep this plan and its notes.`,
        `${recipient.first_name} stopped the calls`,
      );
    }
    return { ok: true, status: "revoked" };
  }

  // Yes / no only count while the request is still open and in date.
  if (recipient.consent_status === "granted" && decision === "yes") return { ok: true, status: "granted" };
  if (recipient.consent_status !== "pending") return { ok: false, reason: "invalid" };
  if (recipient.consent_expires_at && new Date(recipient.consent_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  if (decision === "no") {
    await admin
      .from("nura_care_recipients")
      .update({ consent_status: "declined", consent_method: "link", consent_at: now })
      .eq("id", recipient.id);
    await notifyOwner(
      admin,
      recipient,
      `${recipient.first_name} said no to check-in calls about "${planTitle}", so Nura won't call them. You can keep using the plan yourself.`,
      `${recipient.first_name} said no thanks`,
    );
    return { ok: true, status: "declined" };
  }

  await admin
    .from("nura_care_recipients")
    .update({
      consent_status: "granted",
      consent_method: "link",
      consent_at: now,
      consent_evidence: { copy_version: CONSENT_COPY_VERSION, via: "agree_page", user_agent: evidence.userAgent },
    })
    .eq("id", recipient.id);
  await scheduleFirstRecipientCheckIn(admin, { ...recipient, consent_status: "granted" }, planTitle);
  await notifyOwner(
    admin,
    recipient,
    `${recipient.first_name} said yes, so Nura will give them a short call about "${planTitle}". You'll get a summary here afterwards.`,
    `${recipient.first_name} said yes`,
  );
  return { ok: true, status: "granted" };
}

/** The owner confirms the person agrees, on their behalf. Owner-checked by the caller. */
export async function grantConsentOnBehalf(recipient: CareRecipient, planTitle: string) {
  const admin = getSupabaseAdminClient();
  await admin
    .from("nura_care_recipients")
    .update({
      consent_status: "granted",
      consent_method: "on_behalf",
      consent_at: new Date().toISOString(),
      consent_evidence: { copy_version: CONSENT_COPY_VERSION, via: "owner_on_behalf", confirmed_by: recipient.owner_id },
      revoked_at: null,
      revoke_reason: null,
    })
    .eq("id", recipient.id);
  await scheduleFirstRecipientCheckIn(admin, { ...recipient, consent_status: "granted" }, planTitle);
}

/** The owner turns the calls off. Owner-checked by the caller. */
export async function stopCallsByOwner(recipient: CareRecipient) {
  const admin = getSupabaseAdminClient();
  await admin
    .from("nura_care_recipients")
    .update({ consent_status: "revoked", revoked_at: new Date().toISOString(), revoke_reason: "owner_stopped" })
    .eq("id", recipient.id);
  await cancelOpenCheckIns(admin, recipient.plan_id, "Calls stopped by the plan owner.");
}

export type StopFromCallResult = { ok: true; recipientFirstName: string } | { ok: false; reason: "not_a_recipient_call" };

/**
 * The voice agent's stop_calls tool. The plan is taken from the live call's conversation id
 * where possible, so a call can only ever stop calls about itself.
 */
export async function stopCallsFromCall(conversationId: string | null, planIdHint: string | null): Promise<StopFromCallResult> {
  const admin = getSupabaseAdminClient();
  let planId: string | null = null;
  if (conversationId) {
    const { data: checkIn } = await admin
      .from("nura_check_ins")
      .select("plan_id")
      .eq("call_conversation_id", conversationId)
      .maybeSingle();
    planId = (checkIn?.plan_id as string | undefined) ?? null;
  }
  planId ??= planIdHint;
  if (!planId) return { ok: false, reason: "not_a_recipient_call" };

  const { data: recipient } = await admin.from("nura_care_recipients").select(RECIPIENT_COLUMNS).eq("plan_id", planId).maybeSingle();
  if (!recipient) return { ok: false, reason: "not_a_recipient_call" };
  const row = recipient as CareRecipient;

  if (row.consent_status !== "revoked") {
    await admin
      .from("nura_care_recipients")
      .update({ consent_status: "revoked", revoked_at: new Date().toISOString(), revoke_reason: "stop_on_call" })
      .eq("id", row.id);
    await cancelOpenCheckIns(admin, row.plan_id, `${row.first_name} asked Nura to stop calling.`);
    const { data: plan } = await admin.from("nura_plans").select("title").eq("id", row.plan_id).maybeSingle();
    await notifyOwner(
      admin,
      row,
      `On today's call, ${row.first_name} asked Nura not to call again about "${(plan?.title as string | undefined) ?? "this plan"}", so the calls have stopped. It might be worth a chat with them about it.`,
      `${row.first_name} asked Nura to stop calling`,
    );
  }
  return { ok: true, recipientFirstName: row.first_name };
}
