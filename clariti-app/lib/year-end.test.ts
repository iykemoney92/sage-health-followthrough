import { describe, expect, it } from "vitest";
import { YEAR_END_ITEMS, yearEndOn } from "./year-end";

describe("yearEndOn", () => {
  it("is on through December 2026 only", () => {
    expect(yearEndOn(new Date(2026, 10, 30))).toBe(false);
    expect(yearEndOn(new Date(2026, 11, 1))).toBe(true);
    expect(yearEndOn(new Date(2026, 11, 31))).toBe(true);
    expect(yearEndOn(new Date(2027, 0, 1))).toBe(false);
  });
  it("can be previewed", () => {
    expect(yearEndOn(new Date(2026, 10, 19), "?yearEndPreview=1")).toBe(true);
    expect(yearEndOn(new Date(2026, 10, 19), "?yearEndPreview=0")).toBe(false);
  });
  it("links only to guides", () => {
    for (const i of YEAR_END_ITEMS) expect(i.href).toMatch(/^\/guides\/[a-z0-9-]+$/);
  });
});
