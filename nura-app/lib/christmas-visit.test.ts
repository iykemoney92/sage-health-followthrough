import { describe, expect, it } from "vitest";
import { christmasVisitCopy, christmasVisitDate } from "./christmas-visit";

const on = (y: number, m: number, d: number) => christmasVisitCopy(new Date(y, m - 1, d, 9));

describe("christmasVisitCopy", () => {
  it("is off before 14 December and after 4 January", () => {
    expect(on(2026, 11, 19)).toBeNull();
    expect(on(2026, 12, 13)).toBeNull();
    expect(on(2027, 1, 5)).toBeNull();
    expect(on(2027, 12, 20)).toBeNull();
  });
  it("asks about the visit up to Christmas Day", () => {
    expect(on(2026, 12, 14)?.phase).toBe("before");
    expect(on(2026, 12, 25)?.title).toBe("Seeing family this Christmas?");
  });
  it("turns to January from Boxing Day to 4 January", () => {
    expect(on(2026, 12, 26)?.phase).toBe("after");
    expect(on(2027, 1, 4)?.phase).toBe("after");
  });
  it("never uses clinical wording", () => {
    for (const c of [on(2026, 12, 20), on(2026, 12, 30)]) expect(`${c?.title} ${c?.text}`).not.toMatch(/monitor|diagnos|medic|safe|GP|clinic/i);
  });
});

describe("christmasVisitDate", () => {
  it("reads a preview date and ignores anything else", () => {
    expect(christmasVisitDate("?xmasPreview=2026-12-20").getDate()).toBe(20);
    const now = new Date(2026, 10, 19);
    expect(christmasVisitDate("?xmasPreview=soon", now)).toBe(now);
    expect(christmasVisitDate("", now)).toBe(now);
  });
});
