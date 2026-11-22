import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { opsAlert, resetOpsAlertState } from "@/lib/ops-alert";

// The ops_alert log line (22 Nov 2026): "credit check unavailable" was re-detected on every
// dispatcher tick and wrote an error line a minute. It now logs at most once an hour per
// instance; real call failures still log every time.

function opsAlertLines(spy: ReturnType<typeof vi.spyOn>): Array<Record<string, unknown>> {
  return spy.mock.calls
    .map((args: unknown[]) => {
      try {
        return JSON.parse(String(args[0])) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((line: Record<string, unknown> | null): line is Record<string, unknown> => line?.event === "ops_alert");
}

describe("ops alert log line", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetOpsAlertState();
    vi.stubEnv("OPS_ALERTS", "off"); // log only: no PostHog send from tests
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("logs 'credit check unavailable' once an hour, not every tick", async () => {
    const start = new Date("2026-11-22T10:00:00Z");
    // 59 dispatcher ticks, one a minute.
    for (let minute = 0; minute < 59; minute += 1) {
      await opsAlert("voice_credit_check_unavailable", { error: "missing_permissions" }, new Date(start.getTime() + minute * 60_000));
    }
    expect(opsAlertLines(errorSpy)).toHaveLength(1);

    // An hour after the first line, it logs again and says how many repeats it held back.
    await opsAlert("voice_credit_check_unavailable", { error: "missing_permissions" }, new Date(start.getTime() + 60 * 60_000));
    const lines = opsAlertLines(errorSpy);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ kind: "voice_credit_check_unavailable", repeats_not_logged: 58 });
    expect(lines[0]).not.toHaveProperty("repeats_not_logged");
  });

  it("keeps real call-refused alerts immediate: every failure is logged", async () => {
    const at = new Date("2026-11-22T10:00:00Z");
    for (let i = 0; i < 3; i += 1) {
      await opsAlert("voice_call_failed", { stage: "start", reason: "agent not available" }, new Date(at.getTime() + i * 1_000));
    }
    expect(opsAlertLines(errorSpy).filter((l) => l.kind === "voice_call_failed")).toHaveLength(3);
  });

  it("throttling one kind doesn't hold back another", async () => {
    const at = new Date("2026-11-22T10:00:00Z");
    await opsAlert("voice_credit_check_unavailable", {}, at);
    await opsAlert("voice_credit_check_unavailable", {}, new Date(at.getTime() + 60_000));
    await opsAlert("voice_credits_exhausted", { credits_remaining: 0 }, new Date(at.getTime() + 120_000));
    const kinds = opsAlertLines(errorSpy).map((l) => l.kind);
    expect(kinds).toEqual(["voice_credit_check_unavailable", "voice_credits_exhausted"]);
  });
});
