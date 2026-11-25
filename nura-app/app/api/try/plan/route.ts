import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkKeyedRateLimit } from "@/lib/auth/rate-limit";
import { draftPlanFromIntake, type PlanDraft } from "@/lib/domain/draft-plan-from-intake";
import { draftFirstCheckInFromIntake } from "@/lib/domain/journey-create";
import { inferJourneyDraft, isPlanCategory } from "@/lib/domain/journey-naming";
import {
  crisisCountry,
  countryFromLocale,
  crisisGuidance,
  screenCrisis,
  type CrisisGuidance,
  type CrisisKind,
  type CrisisScreen,
} from "@/lib/domain/crisis-lines";
import { checkinOpenerFallback, composeCheckinOpener } from "@/lib/domain/message-intake";
import { gateTryFirstText } from "@/lib/domain/try-first-gate";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { TRY_FIRST_MAX_CHARS, TRY_FIRST_MIN_CHARS } from "@/lib/try-first";
import { newAiTrace, withAiTrace } from "@/lib/ai/trace";

// "Try Nura first" on the home page: no account. Turns what a visitor types into the Care plan and
// first check-in Nura would make, so they see what it does before signing up. Nothing they type is
// stored or logged here; their browser keeps it (lib/try-first) so onboarding can start from it.
//
// Every try costs three model calls, so it is hard-capped: per visitor (a keyed hash of their IP,
// never the IP itself) and for everyone together, in the shared rate-limit table, with a
// per-instance cap behind that in case the table can't be reached.
export const maxDuration = 60;

const PER_VISITOR_PER_DAY = 3;
const EVERYONE_PER_DAY = 300;
const PER_INSTANCE_PER_HOUR = 60;
const DAY_SECONDS = 24 * 60 * 60;
const EVERYONE_ID = "00000000-0000-4000-8000-000000007e57";

const bodySchema = z.object({
  text: z.string().trim().min(TRY_FIRST_MIN_CHARS).max(TRY_FIRST_MAX_CHARS),
  locale: z.string().max(40).optional(),
  /** The visitor tapped "It isn't an emergency: show me the plan" on an emergency card. */
  notEmergency: z.boolean().optional(),
});

function withTimeout<T>(promise: Promise<T>, fallback: T, ms: number) {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

/** A stable, non-reversible id for this visitor's IP, shaped as a uuid for the rate-limit table. */
function visitorId(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.TRY_FIRST_SALT || "nura-try-first";
  const h = createHmac("sha256", key).update(`try-first:${ip}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Over the try limit. Crisis text still gets the numbers (25 Nov 2026 eval: a 4th try got only "sign up"). */
function limited(message: string, crisis: CrisisGuidance | null) {
  return NextResponse.json(
    crisis ? { ok: false, error: "limited", message: `${crisis.message} ${message}`, crisis } : { ok: false, error: "limited", message },
    { status: 429 },
  );
}

/** Marks a model call that ran out of time, so the route knows no safety check came back. */
const TIMED_OUT = Symbol("timed-out");

/**
 * Country for crisis numbers: the browser's locale region first ("en-US"), then the country
 * Vercel sees the request from. Unsupported or unknown → null (UK numbers plus "your local
 * emergency number").
 */
function visitorCountry(request: NextRequest, locale: string | undefined) {
  const fromLocale = countryFromLocale(locale);
  const fromIp = request.headers.get("x-vercel-ip-country")?.trim().toUpperCase() || null;
  // "en-US" is the default locale on many phones outside the US: when the two disagree, don't
  // pick one; fall back to UK numbers plus "your local emergency number".
  if (fromLocale && fromIp && fromLocale !== fromIp) return null;
  return crisisCountry(fromLocale ?? fromIp);
}

/**
 * Crisis or emergency text gets the numbers to call, never a plan (22 Nov 2026 eval: "I've been
 * saving my tablets" became a Care plan with a check-in tomorrow). 200 with ok:false, so an older
 * page that only knows `message` still shows the numbers as its error line. An emergency card can
 * be passed with "It isn't an emergency" (`canContinue`): the plan then comes with the numbers.
 */
function crisisResponse(request: NextRequest, kind: CrisisKind, locale: string | undefined, source: "screen" | "model") {
  const guidance = crisisGuidance(kind, visitorCountry(request, locale));
  console.info("[try-first] crisis:", kind, source, "block", guidance.country ?? "unknown");
  return NextResponse.json(
    { ok: false, error: "crisis", crisis: guidance, message: guidance.message, canContinue: kind === "emergency" },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const raw = (await request.json().catch(() => null)) as { text?: unknown; locale?: unknown; notEmergency?: unknown } | null;
  const rawLocale = typeof raw?.locale === "string" ? raw.locale.slice(0, 40) : undefined;
  const notEmergency = raw?.notEmergency === true;

  // Before anything else (length, the probe gate, rate limits): "kms" is too short for a plan and
  // would read as gibberish to the gate, but must still get the numbers. No model call.
  // Fail safe (25 Nov 2026): a crisis word that may be a past event, an idiom or a reminder
  // ("Dad had a heart attack last year") adds the numbers to the plan instead of replacing it.
  let screen: CrisisScreen | null = null;
  if (typeof raw?.text === "string") {
    screen = screenCrisis(raw.text.slice(0, TRY_FIRST_MAX_CHARS * 2));
    if (screen?.mode === "block" && !(notEmergency && screen.kind === "emergency")) {
      return crisisResponse(request, screen.kind, rawLocale, "screen");
    }
  }
  // Too short, off topic or over the limit: there's no plan to put the numbers next to, so a
  // crisis word gets the numbers on their own.
  const noPlanCrisis = () => (screen ? crisisResponse(request, screen.kind, rawLocale, "screen") : null);

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return (
      noPlanCrisis() ??
      NextResponse.json(
        {
          ok: false,
          error: "invalid",
          message: `Write a little about what’s going on (at least ${TRY_FIRST_MIN_CHARS} characters).`,
        },
        { status: 400 },
      )
    );
  }
  const text = parsed.data.text;
  const country = () => visitorCountry(request, parsed.data.locale);
  const limitCrisis = () => (screen ? crisisGuidance(screen.kind, country()) : null);

  // Probes, gibberish and non-care requests get a friendly nudge, not a plan (22 Nov 2026: a
  // "connectivity test" became a Care plan). Before the rate limit, so it costs the visitor
  // nothing, and no model is called. Only the reason is logged, never the text.
  const gate = gateTryFirstText(text);
  if (!gate.ok) {
    const crisis = noPlanCrisis();
    if (crisis) return crisis;
    console.info("[try-first] off-topic:", gate.reason);
    return NextResponse.json({ ok: false, error: "off_topic", reason: gate.reason, message: gate.message }, { status: 422 });
  }

  if (checkKeyedRateLimit("try-first:instance", PER_INSTANCE_PER_HOUR, 60 * 60).limited) {
    return limited("Lots of people are trying Nura right now. Please try again in a little while, or sign up free.", limitCrisis());
  }
  try {
    const supabase = getSupabaseServerClient();
    const mine = await checkRateLimit(supabase, visitorId(request), "try-first", PER_VISITOR_PER_DAY, DAY_SECONDS);
    if (mine.limited) {
      return limited("You’ve tried Nura a few times today. Sign up free to keep going: your plan will be waiting.", limitCrisis());
    }
    const everyone = await checkRateLimit(supabase, EVERYONE_ID, "try-first-all", EVERYONE_PER_DAY, DAY_SECONDS);
    if (everyone.limited) {
      return limited("Lots of people are trying Nura today. Please try again tomorrow, or sign up free.", limitCrisis());
    }
  } catch (error) {
    // Rate-limit storage not configured: the per-instance cap above still applies.
    console.error("[try-first] rate limit unavailable:", error instanceof Error ? error.message : "unknown");
  }

  // Signed out: no person, so the three calls share one anonymous trace.
  const traceCtx = newAiTrace({});
  const drafted = await withTimeout<PlanDraft | typeof TIMED_OUT>(
    withAiTrace(traceCtx, () => draftPlanFromIntake(text)),
    TIMED_OUT,
    20000,
  );
  // The numbers shown next to the plan, if any.
  let alongside: CrisisKind | null = screen?.kind ?? null;
  let alongsideSource = "screen";
  let plan: PlanDraft;
  if (drafted === TIMED_OUT) {
    // No safety check came back from the model (25 Nov 2026 eval: the timeout fallback returned a
    // plan with no safety handling). Show the fallback plan, with the crisis lines (which include
    // the emergency number) in case the screen missed something.
    plan = inferJourneyDraft(text, []);
    if (!alongside) {
      alongside = "suicide";
      alongsideSource = "timeout";
    }
    console.info("[try-first] plan timed out: crisis lines added");
  } else {
    plan = drafted;
    // The model's own safety flag, for crisis or emergency wording the screen above missed.
    if (plan.safety) {
      if (!(notEmergency && plan.safety === "emergency")) return crisisResponse(request, plan.safety, parsed.data.locale, "model");
      alongside = "emergency";
      alongsideSource = "model";
    }
  }
  const checkIn = await withAiTrace(traceCtx, () => draftFirstCheckInFromIntake({
    plan: {
      title: plan.title,
      category: isPlanCategory(plan.category) ? plan.category : "general_health",
      whyThisExists: plan.why_this_exists,
      currentFocus: plan.current_focus,
      nextStep: plan.next_step,
    },
    intake: text,
    allowedChannels: ["in_app", "whatsapp", "voice"],
    preferredChannel: "in_app",
  }));
  const message = await withTimeout(
    withAiTrace(traceCtx, () => composeCheckinOpener("there", plan.title, checkIn.prompt, plan.category)),
    checkinOpenerFallback("there", plan.title),
    15000,
  );

  const crisis = alongside ? crisisGuidance(alongside, country(), "alongside") : null;
  if (crisis) console.info("[try-first] crisis:", crisis.kind, alongsideSource, "alongside", crisis.country ?? "unknown");

  return NextResponse.json({
    ok: true,
    plan: {
      title: plan.title,
      why_this_exists: plan.why_this_exists,
      current_focus: plan.current_focus,
      next_step: plan.next_step,
    },
    checkIn: { when: checkIn.when, channel: checkIn.channel, message },
    ...(crisis ? { crisis } : {}),
  });
}
