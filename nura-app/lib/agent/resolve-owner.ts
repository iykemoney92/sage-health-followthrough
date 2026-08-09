import type { SupabaseClient } from "@supabase/supabase-js";

export type OwnerResolveVia =
  | "ownerId"
  | "profile_phone"
  | "whatsapp_link"
  | "recent_voice_checkin"
  | null;

function digitsOnly(value: string | null | undefined) {
  return value ? value.replace(/[^\d]/g, "") : null;
}

/** Nura's own Twilio / WhatsApp numbers — never treat these as the end-user. */
export function isNuraSystemPhone(phoneDigits: string | null | undefined) {
  const phone = digitsOnly(phoneDigits);
  if (!phone) return false;
  const system = [
    process.env.NURA_AGENT_PHONE_DIGITS,
    process.env.ELEVENLABS_AGENT_PHONE_DIGITS,
    process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER,
    "12533672877",
  ]
    .filter(Boolean)
    .map((value) => digitsOnly(String(value))!);
  return system.includes(phone);
}

/**
 * Resolve the Nura account for an ElevenLabs / agent tool call.
 *
 * Outbound voice check-ins often send `x-caller-phone` as Nura's Twilio FROM
 * number, not the user's. Prefer explicit owner/user id, then real user phones,
 * then a recent in-flight voice check-in for the named Care plan.
 */
export async function resolveAgentOwnerId(
  supabase: SupabaseClient,
  options: {
    ownerId?: string | null;
    callerPhoneDigits?: string | null;
    /** Alternate headers ElevenLabs may send for the party being called. */
    calledPhoneDigits?: string | null;
    planTitle?: string | null;
  },
): Promise<{ ownerId: string | null; via: OwnerResolveVia; matchedPhone: string | null }> {
  if (options.ownerId) {
    return { ownerId: options.ownerId, via: "ownerId", matchedPhone: null };
  }

  const candidates = [options.calledPhoneDigits, options.callerPhoneDigits]
    .map(digitsOnly)
    .filter((phone): phone is string => Boolean(phone) && !isNuraSystemPhone(phone));

  for (const phone of candidates) {
    const { data: profile } = await supabase
      .from("nura_profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (profile?.id) {
      return { ownerId: profile.id as string, via: "profile_phone", matchedPhone: phone };
    }

    const { data: link } = await supabase
      .from("nura_channel_links")
      .select("owner_id")
      .eq("provider", "whatsapp")
      .eq("channel_identifier", phone)
      .eq("status", "active")
      .maybeSingle();

    if (link?.owner_id) {
      return { ownerId: link.owner_id as string, via: "whatsapp_link", matchedPhone: phone };
    }
  }

  // Outbound calls: tool webhooks often only see Nura's FROM number. Fall back to
  // the Care plan that was just on an active voice check-in.
  const planTitle = options.planTitle?.trim();
  if (planTitle) {
    const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data: plans } = await supabase
      .from("nura_plans")
      .select("id, owner_id, title")
      .ilike("title", planTitle)
      .limit(10);

    const planIds = (plans ?? []).map((p) => p.id as string);
    if (planIds.length > 0) {
      const { data: recent } = await supabase
        .from("nura_check_ins")
        .select("owner_id, contact_phone, plan_id")
        .in("plan_id", planIds)
        .in("call_status", ["processing", "placed", "completed"])
        .gte("triggered_at", since)
        .order("triggered_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recent?.owner_id) {
        return {
          ownerId: recent.owner_id as string,
          via: "recent_voice_checkin",
          matchedPhone: digitsOnly(recent.contact_phone as string | null),
        };
      }
    }
  }

  return { ownerId: null, via: null, matchedPhone: null };
}

/** Pull likely callee / caller phones from ElevenLabs webhook headers. */
export function extractAgentPhoneHeaders(request: { headers: Headers }) {
  const get = (name: string) => request.headers.get(name);
  return {
    callerPhoneDigits: digitsOnly(
      get("x-caller-phone") || get("x-from-number") || get("from-number"),
    ),
    calledPhoneDigits: digitsOnly(
      get("x-called-phone") ||
        get("x-callee-phone") ||
        get("x-to-number") ||
        get("to-number") ||
        get("called-number"),
    ),
  };
}
