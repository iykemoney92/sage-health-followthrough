import { describe, expect, it } from "vitest";
import { scrubUrl } from "./posthog";

describe("scrubUrl", () => {
  it("redacts sign-in codes and drops the hash", () => {
    expect(scrubUrl("https://useclariti.app/auth/callback?code=secret&next=/workspace")).toBe(
      "https://useclariti.app/auth/callback?code=redacted&next=%2Fworkspace",
    );
    expect(scrubUrl("https://useclariti.app/auth/confirm?token_hash=abc&type=email")).toBe(
      "https://useclariti.app/auth/confirm?token_hash=redacted&type=email",
    );
    expect(scrubUrl("https://useclariti.app/auth/reset-password#access_token=x")).toBe(
      "https://useclariti.app/auth/reset-password",
    );
  });

  it("leaves ordinary addresses alone", () => {
    expect(scrubUrl("https://useclariti.app/workspace?sessionId=123")).toBe("https://useclariti.app/workspace?sessionId=123");
    expect(scrubUrl("")).toBe("");
  });
});
