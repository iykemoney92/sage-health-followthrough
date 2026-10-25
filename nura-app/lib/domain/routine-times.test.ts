import { describe, expect, it, vi } from "vitest";
import { describeRoutineTimes, normalizeRoutineTimes, saveRoutineTimes } from "@/lib/domain/routine-times";

describe("normalizeRoutineTimes", () => {
  it("keeps valid anchors and pads the hour", () => {
    expect(normalizeRoutineTimes({ after_work: "6:00", after_school: "15:30", after_school_run: "" })).toEqual({
      after_work: "06:00",
      after_school: "15:30",
    });
  });

  it("drops unknown anchors and nonsense", () => {
    expect(normalizeRoutineTimes({ after_work: "6pm", bedtime: "22:00", after_school: "25:00" })).toEqual({});
    expect(normalizeRoutineTimes(null)).toEqual({});
  });
});

describe("describeRoutineTimes", () => {
  it("says what is known in both forms", () => {
    expect(describeRoutineTimes({ after_work: "18:00", after_school_run: "09:15" })).toBe(
      "after work = 18:00 (6pm); after the school run = 09:15 (9:15am)",
    );
    expect(describeRoutineTimes({})).toBe("none saved yet");
  });
});

describe("saveRoutineTimes", () => {
  function fakeSupabase() {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    return { client: { from: vi.fn(() => ({ update })) } as never, update };
  }

  it("merges a newly learned time into what was saved", async () => {
    const { client, update } = fakeSupabase();
    const merged = await saveRoutineTimes(client, "u1", { after_school: "15:30" }, { after_work: "18:00" });
    expect(merged).toEqual({ after_school: "15:30", after_work: "18:00" });
    expect(update).toHaveBeenCalledWith({ routine_times: { after_school: "15:30", after_work: "18:00" } });
  });

  it("writes nothing when nothing changed", async () => {
    const { client, update } = fakeSupabase();
    await saveRoutineTimes(client, "u1", { after_work: "18:00" }, { after_work: "18:00" });
    await saveRoutineTimes(client, "u1", { after_work: "18:00" }, null);
    expect(update).not.toHaveBeenCalled();
  });
});
