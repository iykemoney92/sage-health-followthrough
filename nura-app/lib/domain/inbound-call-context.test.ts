import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AGENT_DEFINED_VARIABLES,
  buildInboundCallContext,
  inboundOwnerCallBrief,
  inboundOwnerOpeningLine,
  spokenFirstName,
  unknownCallerContext,
  UNKNOWN_CALLER_OPENING_LINE,
} from "./inbound-call-context";

// Every {{variable}} the live agent's prompt and default first message use. A call drops in about
// a second if any is missing, so the inbound webhook must always send all of them.
const syncScript = readFileSync(join(__dirname, "../../scripts/sync-elevenlabs-agent.mjs"), "utf8");
const agentVariables = [...new Set([...syncScript.matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1]))];

describe("inbound call context", () => {
  it("finds the agent's variables in the sync script", () => {
    expect(agentVariables).toEqual(expect.arrayContaining(["user_name", "thread_title", "call_brief", "circle_pass_on"]));
  });

  it("fills every agent variable for an unknown caller", () => {
    const { dynamicVariables, firstMessage, matched } = unknownCallerContext();
    expect(matched).toBe("unknown");
    expect(firstMessage).toBe(UNKNOWN_CALLER_OPENING_LINE);
    for (const name of agentVariables) {
      expect(typeof dynamicVariables[name], name).toBe("string");
    }
    // Never leaks an account: no user or plan id for someone we couldn't match.
    expect(dynamicVariables.user_id).toBeUndefined();
    expect(dynamicVariables.plan_id).toBeUndefined();
  });

  it("tells the agent an unknown US caller's own crisis numbers (22 Nov 2026 eval)", () => {
    const { dynamicVariables } = unknownCallerContext("17065550100");
    expect(dynamicVariables.call_brief).toContain("988");
    expect(dynamicVariables.thread_context).toContain("the US or Canada");
    // Both are agent-defined variables, so the minimal webhook reply (PR #90) carries them.
    expect(AGENT_DEFINED_VARIABLES).toEqual(expect.arrayContaining(["call_brief", "thread_context"]));
    expect(unknownCallerContext(null).dynamicVariables.call_brief).toContain("ask where they are");
  });

  it("falls back to the generic welcome when there is no caller id", async () => {
    const supabase = {} as never; // never touched without a caller id
    const context = await buildInboundCallContext(supabase, null);
    expect(context.matched).toBe("unknown");
  });

  it("never reads an email display name out loud", () => {
    expect(spokenFirstName("someone@example.com")).toBe("there");
    expect(spokenFirstName("Ada Lovelace")).toBe("Ada");
    expect(spokenFirstName(null)).toBe("there");
    expect(inboundOwnerOpeningLine(spokenFirstName("someone@example.com"))).not.toContain("@");
    expect(inboundOwnerCallBrief("there")).not.toContain("there has called");
  });

  it("greets a known caller by name and says it isn't a scheduled call", () => {
    expect(inboundOwnerOpeningLine("Ike")).toBe("Hi Ike, it's Nura - lovely to hear from you. How are you doing?");
    expect(inboundOwnerOpeningLine("there")).not.toContain("there,");
    const brief = inboundOwnerCallBrief("Ike");
    expect(brief).toContain("called Nura themselves");
    expect(brief).toContain("NOT a scheduled check-in");
  });
});
