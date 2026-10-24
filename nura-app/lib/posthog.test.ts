import { describe, expect, it } from "vitest";
import { scrubUrl } from "./posthog";

describe("scrubUrl", () => {
  it("removes secret link tokens from paths", () => {
    expect(scrubUrl("https://usenura.app/agree/abc123?x=1")).toBe("https://usenura.app/agree/:token?x=1");
    expect(scrubUrl("/join/tok_9")).toBe("/join/:token");
    expect(scrubUrl("https://usenura.app/circle/emails/zzz")).toBe("https://usenura.app/circle/emails/:token");
  });

  it("redacts sign-in codes and drops the hash", () => {
    expect(scrubUrl("https://usenura.app/auth/callback?code=secret&next=/today")).toBe(
      "https://usenura.app/auth/callback?code=redacted&next=%2Ftoday",
    );
    expect(scrubUrl("https://usenura.app/update-password#access_token=x")).toBe("https://usenura.app/update-password");
  });

  it("leaves ordinary addresses alone", () => {
    expect(scrubUrl("https://usenura.app/plans/123?tab=notes")).toBe("https://usenura.app/plans/123?tab=notes");
    expect(scrubUrl("")).toBe("");
  });
});
