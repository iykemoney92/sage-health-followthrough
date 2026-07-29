import { describe, expect, it } from "vitest";
import { rateLimitedResponse } from "./rate-limit";

describe("rateLimitedResponse", () => {
  it("returns a 429 with the expected error body", async () => {
    const response = rateLimitedResponse(30);
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({ ok: false, error: "Too many requests. Please slow down and try again shortly." });
  });

  it("sets a Retry-After header matching the given seconds", () => {
    const response = rateLimitedResponse(45);
    expect(response.headers.get("Retry-After")).toBe("45");
  });

  it("floors Retry-After at 1 second even if given zero or negative", () => {
    expect(rateLimitedResponse(0).headers.get("Retry-After")).toBe("1");
    expect(rateLimitedResponse(-5).headers.get("Retry-After")).toBe("1");
  });
});
