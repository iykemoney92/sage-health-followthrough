import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-path";

describe("safeNextPath", () => {
  it("allows relative same-origin paths", () => {
    expect(safeNextPath("/today")).toBe("/today");
    expect(safeNextPath("/plans?tab=active")).toBe("/plans?tab=active");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("//evil.com")).toBe("/today");
    expect(safeNextPath("https://evil.com")).toBe("/today");
    expect(safeNextPath("/%2f%2fevil.com")).toBe("/today");
  });

  it("uses fallback when empty", () => {
    expect(safeNextPath(null, "/onboarding")).toBe("/onboarding");
  });
});
