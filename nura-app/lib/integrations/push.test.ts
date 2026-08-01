import { describe, expect, it } from "vitest";
import { sanitizePushUrl } from "@/lib/integrations/push";

describe("sanitizePushUrl", () => {
  it("keeps app-relative paths", () => {
    expect(sanitizePushUrl("/today")).toBe("/today");
    expect(sanitizePushUrl("/plans/abc")).toBe("/plans/abc");
  });

  it("rejects open redirects and non-paths", () => {
    expect(sanitizePushUrl("https://evil.example")).toBe("/today");
    expect(sanitizePushUrl("//evil.example")).toBe("/today");
    expect(sanitizePushUrl("javascript:alert(1)")).toBe("/today");
    expect(sanitizePushUrl(undefined)).toBe("/today");
  });
});
