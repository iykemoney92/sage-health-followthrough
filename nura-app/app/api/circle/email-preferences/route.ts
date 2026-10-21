import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { readStopEmailsToken } from "@/lib/care-circle-email";

const postSchema = z.object({ token: z.string().min(10).max(400) });

/**
 * "Stop these emails" from a circle email, no sign-in needed. The signed token names exactly one
 * watcher on one plan and can only switch email off, so a forwarded email can't do more harm
 * than silencing that one person's emails. The page posts here rather than the link doing it,
 * so mail scanners that prefetch links don't unsubscribe anyone.
 */
export async function POST(request: Request) {
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  const target = readStopEmailsToken(parsed.data.token);
  if (!target) return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("nura_plan_members")
    .update({ email_updates: false })
    .eq("plan_id", target.planId)
    .eq("member_id", target.memberId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
