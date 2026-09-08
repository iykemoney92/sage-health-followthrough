import { describe, expect, it } from "vitest";
import { ANON_RATE_LIMITS, checkAnonRateLimit, clientIpFromRequest, enforceAnonRateLimit } from "./anon-rate-limit";

/**
 * The counters are module state, so every test uses its own key and pins `now`.
 * Pinning matters as much as the key: the windows are aligned to the clock, and
 * a run that straddles a boundary would otherwise reset mid-test.
 */
const NOW = 1_700_000_000_000;

function request(headers: Record<string, string>) {
  return new Request("https://useclariti.app/api/auth/password", { headers });
}

describe("clientIpFromRequest", () => {
  it("takes the leftmost forwarded address", () => {
    expect(clientIpFromRequest(request({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to one shared bucket", () => {
    expect(clientIpFromRequest(request({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIpFromRequest(request({}))).toBe("unknown");
  });
});

describe("checkAnonRateLimit", () => {
  it("allows exactly the route's budget, then limits", () => {
    const { limit } = ANON_RATE_LIMITS.resetPassword;
    for (let attempt = 1; attempt <= limit; attempt += 1) {
      expect(checkAnonRateLimit("resetPassword", "budget", NOW).limited).toBe(false);
    }
    expect(checkAnonRateLimit("resetPassword", "budget", NOW).limited).toBe(true);
  });

  it("counts each key separately", () => {
    const { limit } = ANON_RATE_LIMITS.resendConfirmation;
    for (let attempt = 0; attempt <= limit; attempt += 1) {
      checkAnonRateLimit("resendConfirmation", "noisy", NOW);
    }
    expect(checkAnonRateLimit("resendConfirmation", "noisy", NOW).limited).toBe(true);
    expect(checkAnonRateLimit("resendConfirmation", "quiet", NOW).limited).toBe(false);
  });

  it("counts each route separately", () => {
    const { limit } = ANON_RATE_LIMITS.resetPassword;
    for (let attempt = 0; attempt <= limit; attempt += 1) {
      checkAnonRateLimit("resetPassword", "shared", NOW);
    }
    expect(checkAnonRateLimit("resetPassword", "shared", NOW).limited).toBe(true);
    expect(checkAnonRateLimit("password", "shared", NOW).limited).toBe(false);
  });

  it("forgives the caller once the window rolls over", () => {
    const { limit, windowSeconds } = ANON_RATE_LIMITS.resetPassword;
    for (let attempt = 0; attempt <= limit; attempt += 1) {
      checkAnonRateLimit("resetPassword", "rollover", NOW);
    }
    expect(checkAnonRateLimit("resetPassword", "rollover", NOW).limited).toBe(true);
    expect(checkAnonRateLimit("resetPassword", "rollover", NOW + windowSeconds * 1000).limited).toBe(false);
  });

  it("reports a retry-after that lands inside the window", () => {
    const { windowSeconds } = ANON_RATE_LIMITS.password;
    const { retryAfterSeconds } = checkAnonRateLimit("password", "retry-after", NOW);
    expect(retryAfterSeconds).toBeGreaterThan(0);
    expect(retryAfterSeconds).toBeLessThanOrEqual(windowSeconds);
  });

  // Clearing the map used to be the fallback once it grew past its cap, which
  // handed a caller cycling one-shot keys a way to wipe the counter holding it
  // back. Counters doing work survive; the quiet ones are what get evicted.
  it("keeps a counter that is already throttling when a flood of new keys arrives", () => {
    const { limit } = ANON_RATE_LIMITS.resetPassword;
    for (let attempt = 0; attempt <= limit; attempt += 1) {
      checkAnonRateLimit("resetPassword", "held", NOW);
    }
    expect(checkAnonRateLimit("resetPassword", "held", NOW).limited).toBe(true);

    for (let key = 0; key < 6000; key += 1) {
      checkAnonRateLimit("resetPassword", `one-shot-${key}`, NOW);
    }

    expect(checkAnonRateLimit("resetPassword", "held", NOW).limited).toBe(true);
  });
});

describe("enforceAnonRateLimit", () => {
  function attempt(route: "password" | "resetPassword", ip: string, subject: string) {
    return enforceAnonRateLimit(
      new Request("https://useclariti.app/api/auth/password", { headers: { "x-forwarded-for": ip } }),
      route,
      subject,
    );
  }

  // The counter on an address is spent by whoever types it. On sign-in that
  // would let a stranger who merely knows somebody's email lock that person out
  // of their own correct password, from any address, so the route must have no
  // subject ceiling and the subject must never be charged.
  it("never charges the submitted address on the sign-in route", () => {
    const attempts = ANON_RATE_LIMITS.password.limit + 5;
    const responses = [];
    for (let n = 0; n < attempts; n += 1) {
      responses.push(attempt("password", `198.51.100.${n}`, "victim@example.com"));
    }
    expect(responses.every((response) => response === null)).toBe(true);
  });

  // It stays on the routes that send mail, where what it bounds is how much mail
  // one inbox can be made to receive — but loosely enough that a flood cannot
  // cheaply hold a locked-out user's only way back shut.
  it("still bounds one address on the routes that send mail", () => {
    const { subjectLimit } = ANON_RATE_LIMITS.resetPassword;
    for (let n = 0; n < subjectLimit; n += 1) {
      expect(attempt("resetPassword", `203.0.113.${n}`, "mailed@example.com")).toBeNull();
    }
    expect(attempt("resetPassword", "203.0.113.200", "mailed@example.com")?.status).toBe(429);
  });
});
