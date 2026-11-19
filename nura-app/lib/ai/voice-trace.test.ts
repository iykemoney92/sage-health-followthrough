import { describe, expect, it } from "vitest";
import { HEALTH_BRIEF_HEADER } from "@/lib/health/health-brief";
import { nuraVoiceTraceEvents } from "./voice-trace";
import { maskText } from "./voice-trace-core";

const OWNER = "11111111-2222-3333-4444-555555555555";

function call(overrides: Record<string, unknown> = {}, vars: Record<string, unknown> = {}) {
  return {
    conversation_id: "conv_test123",
    agent_id: "agent_nura",
    status: "done",
    metadata: { start_time_unix_secs: 1795000000, call_duration_secs: 42, termination_reason: "end_call tool was called." },
    analysis: { transcript_summary: "Margaret took her tablets. Call me on 07700 900123.", call_successful: "success" },
    conversation_initiation_client_data: { dynamic_variables: { user_id: OWNER, plan_id: "plan-1", on_behalf_of: "", ...vars } },
    transcript: [
      { role: "agent", message: "Hi, it's Nura with your check-in.", time_in_call_secs: 0, source_event_id: 1 },
      { role: "user", message: "Hello! Yes I took them. Email me at jo@example.com", time_in_call_secs: 4, source_event_id: 2 },
      {
        role: "agent",
        message: "Lovely, well done.",
        time_in_call_secs: 6,
        source_event_id: 2,
        producing_llm: "gemini-2.5-flash",
        llm_usage: { model_usage: { "gemini-2.5-flash": { input: { tokens: 100, price: 0.0001 }, output_total: { tokens: 10, price: 0.00002 } } } },
        conversation_turn_metrics: { metrics: { convai_llm_service_ttfb: { elapsed_time: 0.4 }, convai_llm_service_tt_last_sentence: { elapsed_time: 0.9 } } },
      },
    ],
    ...overrides,
  };
}

describe("nuraVoiceTraceEvents", () => {
  it("sends one reply generation (not the scripted greeting) and one trace, for the check-in's owner", async () => {
    const events = await nuraVoiceTraceEvents(call() as never, { id: "ci-1", owner_id: OWNER, plan_id: "plan-1" });
    expect(events.map((e) => e.event)).toEqual(["$ai_generation", "$ai_trace"]);
    const [gen, trace] = events;
    expect(gen.distinct_id).toBe(OWNER);
    expect(gen.properties.product).toBe("nura");
    expect(gen.properties.$ai_trace_id).toBe("conv_test123");
    expect(gen.properties.$ai_session_id).toBe("plan-1");
    expect(gen.properties.$ai_span_name).toBe("checkin_reply");
    expect(gen.properties.$ai_model).toBe("gemini-2.5-flash");
    expect(gen.properties.$ai_input_tokens).toBe(100);
    expect(gen.properties.$ai_latency).toBe(0.9);
    expect(gen.properties.$ai_output_choices).toEqual([{ role: "assistant", content: "Lovely, well done." }]);
    expect(JSON.stringify(gen.properties.$ai_input)).toContain("[email]");
    expect(JSON.stringify(gen.properties.$ai_input)).not.toContain("jo@example.com");
    expect(trace.properties.$ai_span_name).toBe("checkin_call");
    expect(trace.properties.call_status).toBe("completed");
    expect(trace.properties.$ai_latency).toBe(42);
    expect(JSON.stringify(trace.properties.$ai_output_state)).toContain("[phone]");
    expect(gen.properties.$process_person_profile).toBeUndefined();
  });

  it("gives the same uuids for a retried webhook", async () => {
    const a = await nuraVoiceTraceEvents(call() as never, null);
    const b = await nuraVoiceTraceEvents(call() as never, null);
    expect(a.map((e) => e.uuid)).toEqual(b.map((e) => e.uuid));
  });

  it("withholds everything Nura said when the call used Apple Health / Health Connect data", async () => {
    const events = await nuraVoiceTraceEvents(call({}, { thread_context: `${HEALTH_BRIEF_HEADER} Apple Health:\n- Sleep 4h` }) as never, null);
    const text = JSON.stringify(events);
    expect(text).not.toContain("Lovely, well done");
    expect(text).not.toContain("Sleep 4h");
    expect(text).toContain("Yes I took them");
    expect(events[1].properties.health_data_withheld).toBe(true);
  });

  it("marks voicemail, care-recipient and failed calls", async () => {
    const vm = await nuraVoiceTraceEvents(
      call({ transcript: [{ role: "agent", message: "", tool_calls: [{ tool_name: "voicemail_detection" }], time_in_call_secs: 3 }] }, { on_behalf_of: "Sarah" }) as never,
      null,
    );
    const trace = vm.at(-1)!;
    expect(trace.properties.call_status).toBe("voicemail");
    expect(trace.properties.$ai_span_name).toBe("care_recipient_call");
    expect(trace.distinct_id).toBe(OWNER);
    const failed = await nuraVoiceTraceEvents(call({ status: "failed", transcript: [] }, { user_id: undefined }) as never, null);
    expect(failed).toHaveLength(1);
    expect(failed[0].properties.call_status).toBe("failed");
    expect(failed[0].properties.$ai_is_error).toBe(true);
    expect(failed[0].distinct_id).toBe("conv_test123");
    expect(failed[0].properties.$process_person_profile).toBe(false);
  });
});

describe("maskText", () => {
  it("masks written and spoken phone numbers and emails, keeps prices, times and dates", () => {
    expect(maskText("07700-900-123, +44 7700 900123, zero seven seven zero zero nine zero zero one two three")).toBe("[phone], [phone], [phone]");
    expect(maskText("jo at gmail dot com or jo@x.co.uk")).toBe("[email] or [email]");
    expect(maskText("£45 at 9:00 on 2026-11-19, take 2 tablets")).toBe("£45 at 9:00 on 2026-11-19, take 2 tablets");
  });
});
