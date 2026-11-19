import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { gateway, wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from "ai";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";

/**
 * AI quality checks (Ike, 19 Nov 2026): every language-model call Clariti's server makes is
 * sent to PostHog LLM analytics (EU) as one `$ai_generation` event, answers and failures
 * alike, so the explanations can be read, scored and the bad ones fixed. Wrap a model with
 * tracedModel(model, span) where it is used; withAiTrace() at the route says whose request it
 * is. One event per model call, so the SDK's own retries each send one, under one trace id.
 *
 * What never goes: uploaded images and PDFs or generated images (a short marker instead),
 * email addresses and international phone numbers (masked), and anything for a person who
 * turned analytics off (their choice is mirrored to `analytics_opt_out` in their auth
 * metadata by components/posthog-identity.tsx). Video generation is not a language model
 * call and isn't traced.
 *
 * Production only (VERCEL_ENV=production), like the browser PostHog; AI_TRACE=off stops it
 * and AI_TRACE=on turns it on elsewhere for a test. Never throws and never holds up an
 * answer: the send runs in after(), with a 5 s timeout.
 */

const HOST = "https://eu.i.posthog.com/i/v0/e/";
/** Same public, send-only project token the browser uses (lib/posthog.ts). */
const POSTHOG_KEY = "phc_ALci32bGNJvd8BfF7V3RVvW3QxXHF8JeXbwpDgEp28xB";
export const AI_TRACE_PRODUCT = "clariti";
/** PostHog drops events over 1 MB; a thread of documents can be long. */
const MAX_TEXT = 60_000;

export type AiTraceContext = {
  /** The Supabase auth user id (what the browser identifies with), or null when nobody is signed in. */
  distinctId: string | null;
  /** The Clariti session (one document's conversation) when there is one. */
  sessionId: string | null;
  /** Groups every model call made for one request. */
  traceId: string;
};

type AiTraceInput = { distinctId?: string | null; sessionId?: string | null; traceId?: string };

const store = new AsyncLocalStorage<AiTraceContext>();

/** One trace for one request: pass the same context to every withAiTrace in it. */
export function newAiTrace(ctx: AiTraceInput): AiTraceContext {
  return { distinctId: ctx.distinctId ?? null, sessionId: ctx.sessionId ?? null, traceId: ctx.traceId ?? randomUUID() };
}

/** Runs fn with every traced model call inside it attributed to this person and session. */
export function withAiTrace<T>(ctx: AiTraceInput, fn: () => T): T {
  return store.run(newAiTrace(ctx), fn);
}

/** The surrounding context, or a fresh anonymous one for a call made outside withAiTrace. */
export function currentAiTrace(): AiTraceContext {
  return store.getStore() ?? newAiTrace({});
}

type Part = {
  type?: string;
  text?: string;
  mediaType?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
};
type PromptMessage = { role: string; content: unknown };

export type AiGeneration = {
  ctx: AiTraceContext;
  /** What the call was for: "chat_reply", "document_analysis"… */
  span: string;
  model: string;
  provider: string;
  prompt: PromptMessage[];
  /** The model's content parts, or the streamed text, or null on failure. */
  output: Part[] | string | null;
  usage?: { input?: number; output?: number; cacheRead?: number } | null;
  finishReason?: string | null;
  status: number;
  latencyMs: number;
  stream: boolean;
  error?: string | null;
};

/** Bounded so a long run of letters can't make the match quadratic (a 70k-character document took seconds). */
const EMAIL = /[A-Z0-9._%+-]{1,64}@[A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63}){0,6}\.[A-Z]{2,24}/gi;
const PHONE = /\+\d[\d ()-]{6,18}\d/g;

function scrub(text: string): string {
  const cut = text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}… [${text.length - MAX_TEXT} more characters]` : text;
  return cut.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

const fileMarker = (mediaType: string | undefined) => (mediaType?.startsWith("image/") ? "[image]" : "[file]");

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** AI SDK content (a string or parts) as plain text, with files reduced to markers. */
function partsToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return content == null ? "" : stringify(content);
  return (content as Part[])
    .map((part) => {
      switch (part?.type) {
        case "text":
          return String(part.text ?? "");
        case "file":
        case "image":
        case "reasoning-file":
          return fileMarker(part.mediaType);
        case "tool-call":
          return `[tool ${part.toolName ?? ""}] ${stringify(part.input ?? {})}`;
        case "tool-result":
          return `[tool result] ${stringify(part.output ?? "")}`;
        case "reasoning":
          return "";
        default:
          return part?.type ? `[${part.type}]` : "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

export function aiGenerationEvent(g: AiGeneration): Record<string, unknown> {
  const failed = Boolean(g.error) || g.status < 200 || g.status >= 300;
  const outputText = g.output == null ? null : partsToText(g.output);
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
      $ai_provider: g.provider,
      $ai_input: g.prompt.map((m) => ({ role: m.role, content: scrub(partsToText(m.content)) })),
      $ai_output_choices: outputText == null ? [] : [{ role: "assistant", content: scrub(outputText) }],
      $ai_input_tokens: g.usage?.input,
      $ai_output_tokens: g.usage?.output,
      $ai_cache_read_input_tokens: g.usage?.cacheRead,
      $ai_latency: Math.round(g.latencyMs) / 1000,
      $ai_http_status: g.status,
      $ai_is_error: failed,
      $ai_error: failed ? scrub(g.error ?? `status ${g.status}`) : undefined,
      $ai_stream: g.stream,
      finish_reason: g.finishReason ?? undefined,
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

/** True when the person turned analytics off, or when that can't be checked (fails closed). */
async function hasOptedOut(distinctId: string): Promise<boolean> {
  if (!UUID.test(distinctId)) return false;
  const cached = optOutCache.get(distinctId);
  if (cached && Date.now() - cached.at < OPT_OUT_TTL_MS) return cached.optedOut;
  let optedOut = true;
  try {
    const service = getOptionalSupabaseServiceClient();
    if (service) {
      const { data, error } = await service.auth.admin.getUserById(distinctId);
      if (!error && data.user) optedOut = data.user.user_metadata?.analytics_opt_out === true;
    }
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

function providerOf(model: { provider: string; modelId: string }) {
  if (model.provider === "gateway" || model.provider.startsWith("gateway")) {
    return model.modelId.includes("/") ? model.modelId.split("/")[0] : "gateway";
  }
  return model.provider.split(".")[0];
}

function errorStatus(err: unknown) {
  const status = (err as { statusCode?: unknown })?.statusCode;
  return typeof status === "number" ? status : 0;
}

function describe(err: unknown) {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

type Usage = { inputTokens?: { total?: number; cacheRead?: number }; outputTokens?: { total?: number } } | undefined;
const usageOf = (u: Usage) => ({ input: u?.inputTokens?.total, output: u?.outputTokens?.total, cacheRead: u?.inputTokens?.cacheRead });

/** Middleware that sends each generate / stream call to PostHog under the surrounding trace. */
export function aiTraceMiddleware(span: string): LanguageModelMiddleware {
  return {
    specificationVersion: "v4",
    wrapGenerate: async ({ doGenerate, params, model }) => {
      const ctx = currentAiTrace();
      const started = Date.now();
      const base = { ctx, span, model: model.modelId, provider: providerOf(model), prompt: params.prompt as PromptMessage[], stream: false };
      try {
        const result = await doGenerate();
        traceAiGeneration({
          ...base,
          output: result.content as Part[],
          usage: usageOf(result.usage as Usage),
          finishReason: result.finishReason?.unified ?? null,
          status: 200,
          latencyMs: Date.now() - started,
        });
        return result;
      } catch (err) {
        traceAiGeneration({ ...base, output: null, status: errorStatus(err), latencyMs: Date.now() - started, error: describe(err) });
        throw err;
      }
    },
    wrapStream: async ({ doStream, params, model }) => {
      const ctx = currentAiTrace();
      const started = Date.now();
      const base = { ctx, span, model: model.modelId, provider: providerOf(model), prompt: params.prompt as PromptMessage[], stream: true };
      let streamed;
      try {
        streamed = await doStream();
      } catch (err) {
        traceAiGeneration({ ...base, output: null, status: errorStatus(err), latencyMs: Date.now() - started, error: describe(err) });
        throw err;
      }
      let text = "";
      let usage: Usage;
      let finishReason: string | null = null;
      let error: string | null = null;
      const collect = new TransformStream({
        transform(chunk, controller) {
          const part = chunk as { type: string; delta?: string; usage?: Usage; finishReason?: { unified?: string }; error?: unknown };
          if (part.type === "text-delta") text += part.delta ?? "";
          else if (part.type === "finish") {
            usage = part.usage;
            finishReason = part.finishReason?.unified ?? null;
          } else if (part.type === "error") error = describe(part.error);
          controller.enqueue(chunk);
        },
        flush() {
          traceAiGeneration({
            ...base,
            output: text,
            usage: usageOf(usage),
            finishReason,
            status: error ? 0 : 200,
            latencyMs: Date.now() - started,
            error,
          });
        },
      });
      return { ...streamed, stream: streamed.stream.pipeThrough(collect) };
    },
  };
}

/** The model, traced. A gateway id string ("anthropic/claude-sonnet-4.6") goes through the AI Gateway as before. */
export function tracedModel(model: LanguageModel, span: string) {
  return wrapLanguageModel({ model: typeof model === "string" ? gateway(model) : model, middleware: aiTraceMiddleware(span) });
}
