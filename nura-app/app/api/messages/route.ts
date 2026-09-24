import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { enforceThreadLimit, requirePlusAccess } from "@/lib/billing/subscription";
import { aiConsentRequiredResponse, hasAiConsent } from "@/lib/ai-consent";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { resolveDecision, applyPlanDecision, applyNextCheckIn, insertConversationTurn, extractPhoneNumber, type PlanContext, type HistoryTurn, type MissedCheckIn } from "@/lib/domain/message-intake";
import { processAttachments } from "@/lib/ai/attachments";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { MAX_VOICE_NOTE_BYTES, VOICE_NOTES_BUCKET } from "@/lib/voice-notes";
import { evaluateAndAdvanceJourney, ensureJourney } from "@/lib/domain/plan-journey";
import { resolveUserTimeZone } from "@/lib/domain/user-timezone";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MISSED_STATUSES = ["missed_stale", "missed_consolidated", "failed"];
const MAX_ATTACHMENT_BASE64_CHARS = 6_000_000; // ~4.5MB raw per file, base64-encoded

const requestSchema = z
  .object({
    // Empty is allowed only alongside an attachment: a voice note has nothing typed, the
    // transcript becomes the message once the audio has been heard.
    content: z.string().max(20_000).default(""),
    planId: z.string().uuid().optional().nullable(),
    attachments: z.array(z.object({
      name: z.string().min(1),
      type: z.string().default("application/octet-stream"),
      kind: z.enum(["image", "audio", "document", "file"]).default("file"),
      text: z.string().optional().default(""),
      base64: z.string().max(MAX_ATTACHMENT_BASE64_CHARS).optional(),
      // Voice notes arrive by reference: the client already uploaded the recording to the
      // voice-notes bucket, so the bytes are fetched server-side instead of being sent twice.
      storagePath: z.string().max(300).optional(),
      durationMs: z.number().int().min(0).max(10 * 60_000).optional(),
    })).optional().default([]),
  })
  .refine((value) => value.content.trim().length > 0 || value.attachments.length > 0, {
    message: "Say something or attach a file.",
    path: ["content"],
  });

type MessageAttachment = z.infer<typeof requestSchema>["attachments"][number];

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const [{ data, error }, { data: activePlan }] = await Promise.all([
    supabase
    .from("nura_messages")
    .select("id, plan_id, role, content, created_at, attachments")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("nura_plans")
      .select("id, title")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (error) {
    // Pre-migration DBs may not have attachments yet — fall back so chat still loads.
    if (/attachments/i.test(error.message)) {
      const { data: legacy, error: legacyError } = await supabase
        .from("nura_messages")
        .select("id, plan_id, role, content, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (legacyError) {
        return NextResponse.json({ ok: false, error: legacyError.message }, { status: 500 });
      }
      const messages = (legacy ?? []).sort((a, b) => {
        const byTime = new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime();
        if (byTime !== 0) return byTime;
        if (a.role === b.role) return 0;
        return a.role === "user" ? -1 : 1;
      });
      return NextResponse.json({ ok: true, messages, activePlan });
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const messages = (data ?? []).sort((a, b) => {
    const byTime = new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime();
    if (byTime !== 0) return byTime;
    if (a.role === b.role) return 0;
    return a.role === "user" ? -1 : 1;
  });

  return NextResponse.json({ ok: true, messages, activePlan });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!hasAiConsent(user)) {
    return aiConsentRequiredResponse();
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { content, attachments, planId: requestedPlanId } = parsed.data;
  const supabase = await getSupabaseSessionClient();

  const rateLimit = await checkRateLimit(supabase, user.id, "messages", 20, 300);
  if (rateLimit.limited) {
    return rateLimitedResponse(rateLimit.retryAfterSeconds);
  }

  // Voice notes: pull the recording the client just uploaded so it goes through the same
  // transcription path as an attached audio file. The path must sit in the caller's own
  // folder - the bucket policies already enforce that on upload, this stops a crafted request
  // from pointing at someone else's note.
  const voiceNotes = attachments.filter((file) => file.storagePath && !file.base64);
  if (voiceNotes.length > 0) {
    const paywall = await requirePlusAccess(supabase, user.id, "voice");
    if (paywall) return paywall;

    const admin = getSupabaseAdminClient();
    for (const note of voiceNotes) {
      const path = note.storagePath as string;
      if (!path.startsWith(`${user.id}/`) || path.includes("..")) {
        return NextResponse.json({ ok: false, error: "That voice note isn't yours to send." }, { status: 403 });
      }
      const { data: file, error: downloadError } = await admin.storage.from(VOICE_NOTES_BUCKET).download(path);
      if (downloadError || !file) {
        console.error("[messages] voice note download failed", path, downloadError?.message);
        return NextResponse.json({ ok: false, error: "Couldn't read that voice note. Please try again." }, { status: 400 });
      }
      if (file.size > MAX_VOICE_NOTE_BYTES) {
        return NextResponse.json({ ok: false, error: "That voice note is too long to send." }, { status: 413 });
      }
      note.base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      note.kind = "audio";
      if (!note.type || note.type === "application/octet-stream") note.type = file.type || "audio/webm";
    }
  }

  const { data: plans, error: plansError } = await supabase
    .from("nura_plans")
    .select("id, title, current_focus, why_this_exists, next_step, category")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (plansError) {
    return NextResponse.json({ ok: false, error: plansError.message }, { status: 500 });
  }

  const { data: contexts } = await supabase
    .from("nura_source_contexts")
    .select("plan_id, title, summary, kind, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  const { data: recentMessages } = await supabase
    .from("nura_messages")
    .select("role, content, plan_id, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(16);

  const planTitleById = new Map((plans ?? []).map((p) => [p.id, p.title as string]));
  const history: HistoryTurn[] = (recentMessages ?? [])
    .slice()
    .reverse()
    .map((m) => {
      const title = m.plan_id ? planTitleById.get(m.plan_id as string) : null;
      return {
        role: m.role as "user" | "assistant",
        content: title ? `[${title}] ${m.content as string}` : (m.content as string),
      };
    });

  const { data: profile } = await supabase
    .from("nura_profiles")
    .select("phone, preferred_checkin_channels, preferred_checkin_channel")
    .eq("id", user.id)
    .maybeSingle();

  const existingPhone = (profile?.phone as string | null) ?? null;
  const mentionedPhone = extractPhoneNumber(content);
  if (mentionedPhone && mentionedPhone !== existingPhone) {
    await supabase.from("nura_profiles").upsert({ id: user.id, phone: mentionedPhone });
  }
  const phoneOnFile = existingPhone || mentionedPhone || null;
  const allowedChannels = ((profile?.preferred_checkin_channels as string[] | null) ?? ["in_app"]) as ("voice" | "whatsapp" | "in_app")[];
  const preferredChannel = (profile?.preferred_checkin_channel as string | null) ?? null;

  const { data: missedRows } = await supabase
    .from("nura_check_ins")
    .select("prompt, scheduled_for, call_status, plan_id")
    .eq("owner_id", user.id)
    .is("completed_at", null)
    .in("call_status", MISSED_STATUSES)
    .order("scheduled_for", { ascending: false })
    .limit(5);

  const missed: MissedCheckIn[] = (missedRows ?? []).map((row) => ({
    plan_title: planTitleById.get(row.plan_id as string) ?? "a Care plan",
    prompt: row.prompt as string,
    scheduled_for: new Date(row.scheduled_for as string).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
    reason: row.call_status === "failed" ? "the call failed" : "no answer / too much time passed",
  }));

  const requestedPlan = requestedPlanId ? plans?.find((plan) => plan.id === requestedPlanId) ?? null : null;
  const { attachments: sanitizedAttachments, blocks: attachmentBlocks } = await processAttachments(attachments as MessageAttachment[]);

  // A voice note's transcript IS the user's message: it is what Nura reasons over and what
  // the bubble shows under the player. If speech-to-text came back empty the note still
  // needs a body - both for the model (an empty user turn is rejected upstream) and for the
  // transcript history - so say plainly that it couldn't be heard rather than pretending.
  for (const file of sanitizedAttachments) {
    if (file.storagePath && !file.text) {
      file.text = "(voice note - couldn't be transcribed; ask them to type it or send it again)";
    }
  }
  const voiceTranscript = sanitizedAttachments
    .filter((file) => file.storagePath && file.text && !file.text.startsWith("(voice note -"))
    .map((file) => file.text as string)
    .join("\n")
    .trim();
  const typedContent = content.trim();
  const modelContent = typedContent || voiceTranscript || (voiceNotes.length > 0 ? "I sent you a voice note." : "Shared media context with Nura.");
  const storedContent = typedContent || voiceTranscript || (voiceNotes.length > 0 ? "Voice note" : "Shared media context with Nura.");
  const timeZone = await resolveUserTimeZone(supabase, user.id, {
    phoneDigits: phoneOnFile,
    authMetadata: (user.user_metadata ?? null) as Record<string, unknown> | null,
  });
  const decision = await resolveDecision(modelContent, plans ?? [], sanitizedAttachments, (contexts ?? []) as PlanContext[], requestedPlan, history, phoneOnFile, missed, attachmentBlocks, "in_app", allowedChannels, timeZone, preferredChannel);
  const threadLimit = await enforceThreadLimit(supabase, user.id, plans?.length ?? 0, decision.action === "new_plan");
  if (threadLimit) return threadLimit;

  const { planId, planTitle, createdPlan, error: planError } = await applyPlanDecision(supabase, user.id, decision, plans ?? []);
  if (planError) {
    return NextResponse.json({ ok: false, error: planError }, { status: 500 });
  }

  const { error: conversationError } = await insertConversationTurn(
    supabase,
    user.id,
    planId,
    storedContent,
    decision.reply,
    sanitizedAttachments.map((file) => ({
      name: file.name,
      kind: file.kind === "image" || file.kind === "audio" || file.kind === "document" ? file.kind : "file",
      ...(file.storagePath ? { storagePath: file.storagePath, durationMs: file.durationMs ?? null } : {}),
    })),
  );
  if (conversationError) {
    return NextResponse.json({ ok: false, error: conversationError }, { status: 500 });
  }

  if (planId) {
    if (sanitizedAttachments.length > 0) {
      await supabase.from("nura_source_contexts").insert(sanitizedAttachments.map((file) => ({
        owner_id: user.id,
        plan_id: planId,
        kind: file.kind === "image" ? "document_upload" : file.kind === "audio" ? "conversation" : "document_upload",
        title: file.name,
        summary: file.text
          ? `${file.kind} shared in conversation: ${file.text.slice(0, 500)}`
          : `${file.kind} shared in conversation (${file.type}).`,
        requires_user_confirmation: file.kind === "document",
      })));
    }

    if (decision.next_check_in) {
      await applyNextCheckIn(supabase, user.id, planId, decision.next_check_in, timeZone);
    }

    const planForJourney = plans?.find((plan) => plan.id === planId);
    if (createdPlan) {
      // Draft the roadmap as soon as a Journey is born — don't wait for the plan page.
      after(() => ensureJourney(supabase, user.id, createdPlan));
    } else if (planForJourney) {
      // Runs after the response is sent - journey bookkeeping should never delay the visible chat reply.
      after(() => evaluateAndAdvanceJourney(supabase, user.id, planForJourney as never, modelContent, decision.reply));
    }

    const { error: updateError } = await supabase
      .from("nura_plans")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("owner_id", user.id);

    if (updateError) {
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, reply: decision.reply, planId, planTitle, transcript: voiceNotes.length > 0 ? storedContent : null });
}
