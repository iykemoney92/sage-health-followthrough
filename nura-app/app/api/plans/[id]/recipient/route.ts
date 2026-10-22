import { NextResponse } from "next/server";
import { z } from "zod";
import { appOriginFromRequest } from "@/lib/auth/helpers";
import { requirePlusAccess } from "@/lib/billing/subscription";
import { getPlanAccess } from "@/lib/care-circle";
import {
  buildConsentShare,
  firstNameOf,
  loadRecipientForPlan,
  maskPhone,
  newConsentToken,
  type CareRecipient,
} from "@/lib/care-recipient";
import { grantConsentOnBehalf, stopCallsByOwner } from "@/lib/care-recipient-admin";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

function summary(recipient: CareRecipient) {
  return {
    firstName: recipient.first_name,
    relationship: recipient.relationship,
    phoneMasked: maskPhone(recipient.phone),
    timeZone: recipient.time_zone,
    consentStatus: recipient.consent_status,
    consentMethod: recipient.consent_method,
    consentAt: recipient.consent_at,
  };
}

async function ownerRecipient(planId: string) {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) } as const;
  const supabase = await getSupabaseSessionClient();
  const access = await getPlanAccess(supabase, user.id, planId);
  if (!access) return { error: NextResponse.json({ ok: false, error: "not_found" }, { status: 404 }) } as const;
  if (access.role !== "owner") return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) } as const;
  const recipient = await loadRecipientForPlan(supabase, planId);
  if (!recipient) return { error: NextResponse.json({ ok: false, error: "no_recipient" }, { status: 404 }) } as const;
  return { user, supabase, access, recipient } as const;
}

/** Who this plan's calls go to and whether they've agreed. Owner only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await ownerRecipient(id);
  if ("error" in loaded) return loaded.error;
  return NextResponse.json({ ok: true, recipient: summary(loaded.recipient) });
}

const postSchema = z.object({ action: z.enum(["link", "on_behalf", "stop"]) });

/**
 * Owner actions on the person a plan is about:
 * - link: a fresh agreement link to send them (the old one stops working)
 * - on_behalf: the owner confirms they agree, and calls start
 * - stop: no more calls
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const loaded = await ownerRecipient(id);
  if ("error" in loaded) return loaded.error;
  const { user, supabase, access, recipient } = loaded;
  const planTitle = access.plan.title as string;

  if (parsed.data.action === "stop") {
    await stopCallsByOwner(recipient);
    return NextResponse.json({ ok: true, recipient: summary({ ...recipient, consent_status: "revoked" }) });
  }

  const paywall = await requirePlusAccess(supabase, user.id, "voice");
  if (paywall) return paywall;

  if (parsed.data.action === "on_behalf") {
    await grantConsentOnBehalf(recipient, planTitle);
    return NextResponse.json({
      ok: true,
      recipient: summary({ ...recipient, consent_status: "granted", consent_method: "on_behalf", consent_at: new Date().toISOString() }),
    });
  }

  const rateLimit = await checkRateLimit(supabase, user.id, "recipient-consent-link", 10, 60 * 60);
  if (rateLimit.limited) return rateLimitedResponse(rateLimit.retryAfterSeconds);

  // A new link reopens the question, whether they hadn't answered, said no, or stopped calls.
  const token = newConsentToken();
  const { error } = await supabase
    .from("nura_care_recipients")
    .update({
      consent_status: "pending",
      consent_method: null,
      consent_at: null,
      consent_token_hash: token.hash,
      consent_expires_at: token.expiresAt,
    })
    .eq("id", recipient.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: profile } = await supabase.from("nura_profiles").select("display_name").eq("id", user.id).maybeSingle();
  const share = buildConsentShare(appOriginFromRequest(request), token.token, token.expiresAt, {
    ownerFirstName: firstNameOf(profile?.display_name as string | null, "me"),
    recipientFirstName: recipient.first_name,
    planTitle,
  });
  return NextResponse.json({ ok: true, share, recipient: summary({ ...recipient, consent_status: "pending" }) });
}
