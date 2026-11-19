import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { getSupabaseAdminClient } from "@/lib/auth/supabase-admin";
import { HEALTH_BRIEF_HEADER } from "@/lib/health/health-brief";

/**
 * AI quality checks (Ike, 19 Nov 2026): every Claude call Nura's server makes is sent to
 * PostHog LLM analytics (EU) as one `$ai_generation` event, replies and failures alike, so
 * the answers can be read, scored and the bad ones fixed. One event per model call: a
 * direct Anthropic attempt that fails over to AI Gateway sends two, under one trace id.
 *
 * What never goes: images, documents and audio (a short marker instead), Apple Health /
 * Health Connect data (the privacy page promises it is never used for analytics, so the
 * health brief is cut from the prompt and the reply written from it is withheld), phone
 * numbers and email addresses (masked), and anything for a person who turned Product
 * analytics off (their choice is mirrored to `analytics_opt_out` in their auth metadata by
 * components/posthog-identity.tsx). ElevenLabs voice calls are traced separately, from the post-call webhook (lib/ai/voice-trace.ts).
 *
 * Production only (VERCEL_ENV=production), like the browser PostHog; AI_TRACE=off stops it
 * and AI_TRACE=on turns it on elsewhere for a test. Never throws and never holds up a reply:
 * the send runs in after(), with a 5 s timeout.
 */

const HOST = "https://eu.i.posthog.com/i/v0/e/";
/** Same public, send-only project token the browser uses (lib/posthog.ts). */
const POSTHOG_KEY = "phc_ALci32bGNJvd8BfF7V3RVvW3QxXHF8JeXbwpDgEp28xB";
export const AI_TRACE_PRODUCT = "nura";
/** PostHog drops events over 1 MB; Nura's chat system prompt plus history can be long. */
const MAX_TEXT = 60_000;

export type AiTraceContext = {
  /** The Supabase auth user id (what the browser identifies with), or null when nobody is signed in. */
  distinctId: string | null;
  /** The Care plan the conversation is about, when there is one. */
  sessionId: string | null;
  /** Groups every model call made for one request or one scheduled job. */
  traceId: string;
};

const store = new AsyncLocalStorage<AiTraceContext>();

type AiTraceInput = { distinctId?: string | null; sessionId?: string | null; traceId?: string };

/** One trace for one request: pass the same context to every withAiTrace in it. */
export function newAiTrace(ctx: AiTraceInput): AiTraceContext {
  return { distinctId: ctx.distinctId ?? null, sessionId: ctx.sessionId ?? null, traceId: ctx.traceId ?? randomUUID() };
}

/** Runs fn with every Claude call inside it attributed to this person and Care plan. */
export function withAiTrace<T>(ctx: AiTraceInput, fn: () => T): T {
  return store.run(newAiTrace(ctx), fn);
}

/** The surrounding context, or a fresh anonymous one for a call made outside withAiTrace. */
export function currentAiTrace(): AiTraceContext {
  return store.getStore() ?? { distinctId: null, sessionId: null, traceId: randomUUID() };
}

type Block = { type?: string; text?: string; name?: string; input?: unknown; content?: unknown };
type Message = { role: string; content: unknown };

export type AiGeneration = {
  ctx: AiTraceContext;
  /** What the call was for: "message-intake", "plan-journey"… (the claudeClient label). */
  span: string;
  model: string;
  /** "anthropic" for Nura's own key, "gateway" when it failed over to Vercel AI Gateway. */
  route: "anthropic" | "gateway";
  system: unknown;
  messages: Message[];
  response: {
    content?: Block[];
    usage?: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } | null;
    stop_reason?: string | null;
  } | null;
  status: number;
  latencyMs: number;
  error?: string | null;
};

/** Bounded so a long run of letters can't make the match quadratic (a 70k-character document took seconds). */
const EMAIL = /[A-Z0-9._%+-]{1,64}@[A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63}){0,6}\.[A-Z]{2,24}/gi;
const PHONE = /\+\d[\d ()-]{6,18}\d/g;
const HEALTH_BRIEF = new RegExp(`${escapeRegExp(HEALTH_BRIEF_HEADER)}[^\\n]*(?:\\n- [^\\n]*)*`, "g");
const HAS_HEALTH_BRIEF = new RegExp(escapeRegExp(HEALTH_BRIEF_HEADER));
const HEALTH_MARKER = "[Apple Health / Health Connect data withheld]";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scrub(text: string): string {
  const withoutHealth = text.replace(HEALTH_BRIEF, HEALTH_MARKER);
  const cut =
    withoutHealth.length > MAX_TEXT
      ? `${withoutHealth.slice(0, MAX_TEXT)}… [${withoutHealth.length - MAX_TEXT} more characters]`
      : withoutHealth;
  return cut.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

/** Anthropic content (a string or blocks) as plain text, with files reduced to markers. */
function blocksToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : String(content);
  return (content as Block[])
    .map((block) => {
      switch (block?.type) {
        case "text":
          return String(block.text ?? "");
        case "image":
          return "[image]";
        case "document":
          return "[document]";
        case "tool_use":
          return `[tool ${block.name ?? ""}] ${JSON.stringify(block.input ?? {})}`;
        case "tool_result":
          return `[tool result] ${blocksToText(block.content)}`;
        case "thinking":
        case "redacted_thinking":
          return "";
        default:
          return block?.type ? `[${block.type}]` : "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

const num = (v: unknown) => (typeof v === "number" ? v : undefined);

export function aiGenerationEvent(g: AiGeneration): Record<string, unknown> {
  const failed = Boolean(g.error) || g.status < 200 || g.status >= 300;
  const input = [
    ...(g.system ? [{ role: "system", content: blocksToText(g.system) }] : []),
    ...g.messages.map((m) => ({ role: m.role, content: blocksToText(m.content) })),
  ];
  const usedHealthData = input.some((m) => HAS_HEALTH_BRIEF.test(m.content));
  const outputText = g.response?.content ? blocksToText(g.response.content) : null;
  const usage = g.response?.usage ?? null;
  return {
    api_key: POSTHOG_KEY,
    event: "$ai_generation",
    distinct_id: g.ctx.distinctId ?? g.ctx.traceId,
    properties: {
      product: AI_TRACE_PRODUCT,
      $ai_trace_id: g.ctx.traceId,
      $ai_session_id: g.ctx.sessionId,
      $ai_span_name: g.span,
      $ai_model: g.model,
      $ai_provider: "anthropic",
      $ai_base_url: g.route === "gateway" ? "https://ai-gateway.vercel.sh" : "https://api.anthropic.com",
      $ai_input: input.map((m) => ({ role: m.role, content: scrub(m.content) })),
      $ai_output_choices:
        outputText == null
          ? []
          : [
              {
                role: "assistant",
                content: usedHealthData ? "[reply withheld: it was written with Apple Health / Health Connect data]" : scrub(outputText),
              },
            ],
      $ai_input_tokens: num(usage?.input_tokens),
      $ai_output_tokens: num(usage?.output_tokens),
      $ai_cache_read_input_tokens: num(usage?.cache_read_input_tokens),
      $ai_cache_creation_input_tokens: num(usage?.cache_creation_input_tokens),
      $ai_latency: Math.round(g.latencyMs) / 1000,
      $ai_http_status: g.status,
      $ai_is_error: failed,
      $ai_error: failed ? scrub(g.error ?? `status ${g.status}`) : undefined,
      $ai_stream: false,
      stop_reason: g.response?.stop_reason ?? undefined,
      health_data_withheld: usedHealthData || undefined,
      ...(g.ctx.distinctId ? {} : { $process_person_profile: false }),
    },
  };
}

export function aiTraceEnabled() {
  const flag = process.env.AI_TRACE?.trim().toLowerCase();
  if (flag === "off") return false;
  return flag === "on" || process.env.VERCEL_ENV === "production";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const optOutCache = new Map<string, { optedOut: boolean; at: number }>();
const OPT_OUT_TTL_MS = 5 * 60_000;

/** True when the person turned Product analytics off, or when that can't be checked (fails closed). */
export async function hasOptedOut(distinctId: string): Promise<boolean> {
  if (!UUID.test(distinctId)) return false;
  const cached = optOutCache.get(distinctId);
  if (cached && Date.now() - cached.at < OPT_OUT_TTL_MS) return cached.optedOut;
  let optedOut = true;
  try {
    const { data, error } = await getSupabaseAdminClient().auth.admin.getUserById(distinctId);
    if (!error && data.user) optedOut = data.user.user_metadata?.analytics_opt_out === true;
  } catch {
    // Unknown: don't send.
  }
  optOutCache.set(distinctId, { optedOut, at: Date.now() });
  return optedOut;
}

async function send(g: AiGeneration): Promise<void> {
  try {
    if (g.ctx.distinctId && (await hasOptedOut(g.ctx.distinctId))) return;
    const res = await fetch(HOST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiGenerationEvent(g)),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) console.error(`[ai trace] PostHog answered ${res.status}`);
  } catch (e) {
    console.error("[ai trace] send failed:", (e as Error)?.name ?? "error");
  }
}

/** Queues the event to send after the response; outside a request it just runs in the background. */
export function traceAiGeneration(g: AiGeneration): void {
  if (!aiTraceEnabled()) return;
  try {
    after(() => send(g));
  } catch {
    void send(g);
  }
}
