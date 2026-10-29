import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the work's result and never runs the timeout once it has arrived", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const result = await withTimeout(Promise.resolve("reply"), "slow", 45000, onTimeout);
    expect(result).toBe("reply");
    // The timer is gone: nothing is left to fire 45 s later (29 Oct 2026: false "[AI DOWN]" logs).
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("gives the fallback and runs the timeout when the work is too slow", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve("late reply"), 60000));
    const pending = withTimeout(slow, "slow", 45000, onTimeout);
    await vi.advanceTimersByTimeAsync(45000);
    await expect(pending).resolves.toBe("slow");
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("clears the timer when the work fails, and passes the failure on", async () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    await expect(withTimeout(Promise.reject(new Error("boom")), "slow", 45000, onTimeout)).rejects.toThrow("boom");
    expect(vi.getTimerCount()).toBe(0);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
