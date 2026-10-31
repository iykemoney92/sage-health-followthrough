import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkKeyedRateLimit } from "@/lib/auth/rate-limit";
import { draftPlanFromIntake } from "@/lib/domain/draft-plan-from-intake";
import { draftFirstCheckInFromIntake } from "@/lib/domain/journey-create";
import { inferJourneyDraft, isPlanCategory } from "@/lib/domain/journey-naming";
import { composeCheckinOpener } from "@/lib/domain/message-intake";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";
import { checkRateLimit } from "@/lib/rate-limit";
import { TRY_FIRST_MAX_CHARS, TRY_FIRST_MIN_CHARS } from "@/lib/try-first";

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

function limited(message: string) {
  return NextResponse.json({ ok: false, error: "limited", message }, { status: 429 });
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid",
        message: `Write a little about what’s going on (at least ${TRY_FIRST_MIN_CHARS} characters).`,
      },
      { status: 400 },
    );
  }
  const text = parsed.data.text;

  if (checkKeyedRateLimit("try-first:instance", PER_INSTANCE_PER_HOUR, 60 * 60).limited) {
    return limited("Lots of people are trying Nura right now. Please try again in a little while, or sign up free.");
  }
  try {
    const supabase = getSupabaseServerClient();
    const mine = await checkRateLimit(supabase, visitorId(request), "try-first", PER_VISITOR_PER_DAY, DAY_SECONDS);
    if (mine.limited) {
      return limited("You’ve tried Nura a few times today. Sign up free to keep going: your plan will be waiting.");
    }
    const everyone = await checkRateLimit(supabase, EVERYONE_ID, "try-first-all", EVERYONE_PER_DAY, DAY_SECONDS);
    if (everyone.limited) {
      return limited("Lots of people are trying Nura today. Please try again tomorrow, or sign up free.");
    }
  } catch (error) {
    // Rate-limit storage not configured: the per-instance cap above still applies.
    console.error("[try-first] rate limit unavailable:", error instanceof Error ? error.message : "unknown");
  }

  const plan = await withTimeout(draftPlanFromIntake(text), inferJourneyDraft(text, []), 20000);
  const checkIn = await draftFirstCheckInFromIntake({
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
  });
  const message = await withTimeout(
    composeCheckinOpener("there", plan.title, checkIn.prompt, plan.category),
    `Checking in on ${plan.title}: ${checkIn.prompt}`,
    15000,
  );

  return NextResponse.json({
    ok: true,
    plan: {
      title: plan.title,
      why_this_exists: plan.why_this_exists,
      current_focus: plan.current_focus,
      next_step: plan.next_step,
    },
    checkIn: { when: checkIn.when, channel: checkIn.channel, message },
  });
}
