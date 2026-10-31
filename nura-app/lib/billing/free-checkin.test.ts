import { describe, expect, it } from "vitest";
import { pickFreeCheckIns } from "@/lib/billing/free-checkin";

describe("pickFreeCheckIns", () => {
  const due = [
    { id: "a2", owner_id: "free-new", scheduled_for: "2026-11-01T10:00:00Z" },
    { id: "a1", owner_id: "free-new", scheduled_for: "2026-11-01T09:00:00Z" },
    { id: "b1", owner_id: "free-used", scheduled_for: "2026-11-01T09:00:00Z" },
    { id: "c1", owner_id: "plus", scheduled_for: "2026-11-01T09:00:00Z" },
  ];
  const plus = new Map([
    ["free-new", false],
    ["free-used", false],
    ["plus", true],
  ]);

  it("lets only the earliest check-in through for someone who hasn't had their free one", () => {
    const free = pickFreeCheckIns(due, plus, new Set(["free-used"]));
    expect([...free]).toEqual(["a1"]);
  });

  it("gives nothing free to someone who already had it", () => {
    const free = pickFreeCheckIns(due, plus, new Set(["free-used", "free-new"]));
    expect(free.size).toBe(0);
  });

  it("never marks a Plus owner's check-ins as the free one", () => {
    const free = pickFreeCheckIns(due, plus, new Set());
    expect(free.has("c1")).toBe(false);
    expect(free.has("b1")).toBe(true);
  });

  it("treats an unknown owner as not Plus", () => {
    const free = pickFreeCheckIns([{ id: "z", owner_id: "unknown", scheduled_for: null }], new Map(), new Set());
    expect([...free]).toEqual(["z"]);
  });
});
