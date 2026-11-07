import { describe, expect, it } from "vitest";
import { isNewAccount } from "./new-account";
import { isPublicPath } from "../quora-pixel";

describe("provider sign-ups counted on /joined", () => {
  const now = Date.parse("2026-11-07T10:00:00Z");
  it("an account made in the last five minutes is new; an older one is a returning sign-in", () => {
    expect(isNewAccount("2026-11-07T09:59:30Z", now)).toBe(true);
    expect(isNewAccount("2026-11-07T09:54:00Z", now)).toBe(false);
    expect(isNewAccount("2026-10-01T09:00:00Z", now)).toBe(false);
    expect(isNewAccount(undefined, now)).toBe(false);
    expect(isNewAccount("not a date", now)).toBe(false);
  });
  it("/joined is a public page, where the pixels may run after Accept; signed-in pages stay closed", () => {
    expect(isPublicPath("/joined")).toBe(true);
    expect(isPublicPath("/onboarding")).toBe(false);
    expect(isPublicPath("/today")).toBe(false);
  });
});
