import { createHash } from "node:crypto";

/**
 * Voice calls -> PostHog LLM analytics (19 Nov 2026). An ElevenLabs conversation (the post-call webhook's `data`,
 * or GET /v1/convai/conversations/{id}: same shape) becomes:
 * - one `$ai_trace` per call ($ai_trace_id = the conversation id) with the whole transcript, duration and status;
 * - one `$ai_generation` per agent reply the LLM wrote: input = the call so far, output = what the agent said.
 * The scripted greeting is not a generation. Audio never goes, only text. Phone numbers (written or spoken digit
 * by digit) and email addresses are masked, and text is cut at 60k characters. Event uuids come from the
 * conversation id, so a retried webhook or a re-send stores the same events again instead of new ones.
 */

const POSTHOG_BATCH = "https://eu.i.posthog.com/batch/";
const POSTHOG_KEY = "phc_ALci32bGNJvd8BfF7V3RVvW3QxXHF8JeXbwpDgEp28xB";
const MAX_TEXT = 60_000;
/** Older turns are dropped from a reply's input past this many messages (the trace still has the whole call). */
const MAX_HISTORY = 60;

type Usage = { tokens?: number; price?: number };
type ModelUsage = Record<string, { input?: Usage; input_cache_read?: Usage; input_cache_write?: Usage; output_total?: Usage }>;
type Turn = {
  role?: string;
  message?: string | null;
  original_message?: string | null;
  interrupted?: boolean;
  time_in_call_secs?: number;
  source_event_id?: number;
  producing_llm?: string | null;
  tool_calls?: { tool_name?: string; params_as_json?: string }[] | null;
  tool_results?: { tool_name?: string; result_value?: string; is_error?: boolean }[] | null;
  llm_usage?: { model_usage?: ModelUsage } | null;
  conversation_turn_metrics?: { metrics?: Record<string, { elapsed_time?: number }> } | null;
};
export type ElevenLabsConversation = {
  conversation_id: string;
  agent_id?: string;
  status?: string;
  transcript?: Turn[] | null;
  metadata?: {
    start_time_unix_secs?: number;
    call_duration_secs?: number;
    termination_reason?: string;
    error?: unknown;
    phone_call?: { direction?: string; type?: string } | null;
    conversation_initiation_source?: string;
    cost?: number;
    charging?: { llm_price?: number } | null;
  } | null;
  analysis?: { transcript_summary?: string | null; call_successful?: string | null; call_summary_title?: string | null } | null;
};

export type VoiceTraceOptions = {
  product: string;
  /** What the call is, e.g. "receptionist_call"; each reply's span is the same name with "_reply". */
  span: string;
  /** The product's identified user (what the app passes to identify), or null: then the call stays anonymous. */
  distinctId: string | null;
  sessionId?: string | null;
  /** completed / voicemail / no_answer / failed / short… */
  callStatus: string;
  /** The agent's configured LLM, used when a turn doesn't name the model that wrote it. */
  model?: string | null;
  /**
   * When set, everything the agent said (and the call summary) is replaced by this marker: for calls whose
   * context held data the product promised never to send to analytics. The person's own words still go.
   */
  withholdReplies?: string | null;
  /** Extra properties on every event (call kind, plan id…). Never put phone numbers or emails here. */
  extra?: Record<string, unknown>;
};

type PhEvent = { event: string; distinct_id: string; uuid: string; timestamp: string; properties: Record<string, unknown> };

const EMAIL = /[A-Z0-9._%+-]{1,64}@[A-Z0-9-]{1,63}(?:\.[A-Z0-9-]{1,63}){0,6}\.[A-Z]{2,24}/gi;
const SPOKEN_EMAIL = /\b[\w.+-]{1,64}\s+at\s+[\w-]{1,63}(?:\s+dot\s+[a-z]{2,24}){1,4}\b/gi;
/** Digit runs (with spaces, dots, dashes, brackets) holding 7+ digits: phone numbers, not prices, times or years. */
const DIGITS = /\+?\d[\d\s().-]{4,24}\d/g;
const ISO_DATE = /^\d{4}-\d{1,2}-\d{1,2}(?:\D|$)/;
const DIGIT_WORD = "(?:zero|oh|nought|one|two|three|four|five|six|seven|eight|nine|double|triple)";
/** A number read back word by word: "zero seven seven zero zero, nine zero zero…". */
const SPOKEN_DIGITS = new RegExp(`\\b${DIGIT_WORD}(?:[\\s,.-]+${DIGIT_WORD}){6,}\\b`, "gi");

export function maskText(text: string): string {
  const cut = text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}… [${text.length - MAX_TEXT} more characters]` : text;
  return cut
    .replace(EMAIL, "[email]")
    .replace(SPOKEN_EMAIL, "[email]")
    .replace(DIGITS, (m) => ((m.match(/\d/g)?.length ?? 0) >= 7 && !ISO_DATE.test(m) ? "[phone]" : m))
    .replace(SPOKEN_DIGITS, "[phone]");
}

/** A stable uuid from a string, so the same call and turn always map to the same PostHog event. */
export function stableUuid(seed: string): string {
  const h = createHash("sha256").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const toolLine = (t: { tool_name?: string; params_as_json?: string }) =>
  `[tool ${t.tool_name ?? ""}] ${String(t.params_as_json ?? "").slice(0, 2000)}`;
const resultLine = (t: { tool_name?: string; result_value?: string; is_error?: boolean }) =>
  `[tool result ${t.tool_name ?? ""}${t.is_error ? " (error)" : ""}] ${String(t.result_value ?? "").slice(0, 2000)}`;

function usageOf(turns: Turn[]) {
  let input = 0, cacheRead = 0, cacheWrite = 0, output = 0, cost = 0, seen = false;
  for (const t of turns) {
    for (const u of Object.values(t.llm_usage?.model_usage ?? {})) {
      seen = true;
      input += u.input?.tokens ?? 0;
      cacheRead += u.input_cache_read?.tokens ?? 0;
      cacheWrite += u.input_cache_write?.tokens ?? 0;
      output += u.output_total?.tokens ?? 0;
      cost += (u.input?.price ?? 0) + (u.input_cache_read?.price ?? 0) + (u.input_cache_write?.price ?? 0) + (u.output_total?.price ?? 0);
    }
  }
  return seen ? { input: input + cacheRead + cacheWrite, cacheRead, cacheWrite, output, cost } : null;
}

function metric(turns: Turn[], ...names: string[]) {
  for (const name of names) for (const t of turns) {
    const v = t.conversation_turn_metrics?.metrics?.[name]?.elapsed_time;
    if (typeof v === "number") return Math.round(v * 1000) / 1000;
  }
  return undefined;
}

/** Simple call status from the conversation itself, for products without their own outcome logic. */
export function basicCallStatus(c: ElevenLabsConversation): string {
  if (c.status === "failed") return "failed";
  const turns = c.transcript ?? [];
  if (turns.some((t) => t.tool_calls?.some((x) => x.tool_name === "voicemail_detection"))) return "voicemail";
  if (/voicemail/i.test(c.metadata?.termination_reason ?? "")) return "voicemail";
  const userSpoke = turns.some((t) => t.role === "user" && t.message && t.message.trim() && t.message.trim() !== "...");
  return userSpoke ? "completed" : "no_speech";
}

export function voiceCallEvents(c: ElevenLabsConversation, o: VoiceTraceOptions): PhEvent[] {
  const convId = c.conversation_id;
  const start = (c.metadata?.start_time_unix_secs ?? Math.floor(Date.now() / 1000)) * 1000;
  const at = (secs?: number) => new Date(start + Math.round((secs ?? 0) * 1000)).toISOString();
  const distinctId = o.distinctId ?? convId;
  const common: Record<string, unknown> = {
    product: o.product,
    conversation_id: convId,
    agent_id: c.agent_id,
    call_status: o.callStatus,
    ...o.extra,
    ...(o.distinctId ? {} : { $process_person_profile: false }),
  };
  const replySpan = `${o.span.replace(/_call$/, "")}_reply`;
  const events: PhEvent[] = [];
  const history: { role: string; content: string }[] = [];
  const turns = c.transcript ?? [];
  let userSpoke = false;

  for (let i = 0; i < turns.length; ) {
    const t = turns[i];
    if (t.role !== "agent") {
      const text = (t.message ?? "").trim();
      if (text) {
        if (text !== "...") userSpoke = true;
        history.push({ role: "user", content: maskText(text) });
      }
      i += 1;
      continue;
    }
    // One LLM response can be split over several agent entries (speech, then a tool call), all with one source_event_id.
    const group: Turn[] = [t];
    let j = i + 1;
    while (j < turns.length && turns[j].role === "agent" && t.source_event_id != null && turns[j].source_event_id === t.source_event_id) {
      group.push(turns[j]);
      j += 1;
    }
    const index = i;
    i = j;
    const spoken = group.map((g) => (g.original_message || g.message || "").trim()).filter(Boolean);
    const calls = group.flatMap((g) => g.tool_calls ?? []).map(toolLine);
    const results = group.flatMap((g) => g.tool_results ?? []).map(resultLine);
    const said = o.withholdReplies && (spoken.length || calls.length) ? o.withholdReplies : [...spoken, ...calls].join("\n");
    const usage = usageOf(group);
    const model = group.find((g) => g.producing_llm)?.producing_llm ?? o.model ?? undefined;
    // The greeting before anyone speaks is scripted; tool results alone aren't a model reply either.
    const isReply = said && (usage || userSpoke);
    if (isReply) {
      const interrupted = group.some((g) => g.interrupted);
      events.push({
        event: "$ai_generation",
        distinct_id: distinctId,
        uuid: stableUuid(`${o.product}:${convId}:gen:${index}`),
        timestamp: at(group[0].time_in_call_secs),
        properties: {
          ...common,
          $ai_trace_id: convId,
          $ai_session_id: o.sessionId ?? convId,
          $ai_parent_id: convId,
          $ai_span_id: `${convId}:${index}`,
          $ai_span_name: replySpan,
          $ai_model: model,
          $ai_provider: "elevenlabs",
          $ai_input: history.slice(-MAX_HISTORY),
          $ai_output_choices: [{ role: "assistant", content: maskText(said) }],
          $ai_input_tokens: usage?.input,
          $ai_output_tokens: usage?.output,
          $ai_cache_read_input_tokens: usage?.cacheRead,
          $ai_cache_creation_input_tokens: usage?.cacheWrite,
          $ai_total_cost_usd: usage ? Math.round(usage.cost * 1e8) / 1e8 : undefined,
          $ai_latency: metric(group, "convai_llm_service_tt_last_sentence", "convai_llm_tool_request_generation_latency", "convai_llm_service_ttfb"),
          $ai_time_to_first_token: metric(group, "convai_llm_service_ttfb"),
          $ai_http_status: 200,
          $ai_is_error: false,
          $ai_stream: true,
          turn_index: index,
          time_in_call_secs: group[0].time_in_call_secs,
          interrupted: interrupted || undefined,
          replies_withheld: o.withholdReplies ? true : undefined,
          spoken_before_interruption: interrupted && !o.withholdReplies ? maskText(group.map((g) => g.message ?? "").join(" ").trim()) : undefined,
        },
      });
    }
    if (said) history.push({ role: "assistant", content: maskText(said) });
    for (const r of results) history.push({ role: "tool", content: o.withholdReplies ? "[tool result withheld]" : maskText(r) });
  }

  const usage = usageOf(turns);
  const failed = o.callStatus === "failed" || c.status === "failed";
  const summary = c.analysis?.transcript_summary;
  events.push({
    event: "$ai_trace",
    distinct_id: distinctId,
    uuid: stableUuid(`${o.product}:${convId}:trace`),
    timestamp: at(0),
    properties: {
      ...common,
      $ai_trace_id: convId,
      $ai_session_id: o.sessionId ?? convId,
      $ai_span_name: o.span,
      $ai_input_state: history.slice(-200),
      $ai_output_state: {
        call_status: o.callStatus,
        summary: summary ? (o.withholdReplies ? o.withholdReplies : maskText(summary)) : null,
        title: o.withholdReplies ? null : (c.analysis?.call_summary_title ?? null),
        ended_because: c.metadata?.termination_reason ?? null,
      },
      $ai_latency: c.metadata?.call_duration_secs ?? 0,
      $ai_is_error: failed,
      $ai_error: failed ? maskText(String(c.metadata?.termination_reason || c.metadata?.error || "call failed")) : undefined,
      $ai_model: o.model ?? turns.find((t) => t.producing_llm)?.producing_llm ?? undefined,
      $ai_provider: "elevenlabs",
      $ai_input_tokens: usage?.input,
      $ai_output_tokens: usage?.output,
      $ai_total_cost_usd: usage ? Math.round(usage.cost * 1e8) / 1e8 : undefined,
      call_duration_secs: c.metadata?.call_duration_secs ?? 0,
      elevenlabs_status: c.status,
      elevenlabs_call_successful: c.analysis?.call_successful ?? undefined,
      channel: c.metadata?.phone_call?.type ?? c.metadata?.conversation_initiation_source ?? undefined,
      direction: c.metadata?.phone_call?.direction ?? undefined,
      agent_replies: events.length,
      user_turns: turns.filter((t) => t.role === "user" && t.message?.trim()).length,
    },
  });
  return events;
}

/** Sends the events in one batch. Never throws; logs and gives up after 5 s. */
export async function sendVoiceEvents(events: PhEvent[]): Promise<boolean> {
  if (!events.length) return true;
  try {
    const res = await fetch(POSTHOG_BATCH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: POSTHOG_KEY, batch: events }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) console.error(`[voice trace] PostHog answered ${res.status}`);
    return res.ok;
  } catch (e) {
    console.error("[voice trace] send failed:", (e as Error)?.name ?? "error");
    return false;
  }
}
