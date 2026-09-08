import { describe, expect, it } from "vitest";
import { providerTokenPresence } from "./provider-tokens";

describe("providerTokenPresence", () => {
  it("reports what Apple returned without carrying the tokens", () => {
    const presence = providerTokenPresence({
      provider_token: "apple-id-token",
      provider_refresh_token: "apple-refresh-token",
      user: { app_metadata: { provider: "apple" } },
    });

    expect(presence).toEqual({ provider: "apple", hasProviderToken: true, hasProviderRefreshToken: true });
    expect(JSON.stringify(presence)).not.toContain("apple-refresh-token");
  });

  it("distinguishes a missing refresh token from a missing session", () => {
    expect(
      providerTokenPresence({
        provider_token: "google-access-token",
        provider_refresh_token: null,
        user: { app_metadata: { provider: "google" } },
      }),
    ).toEqual({ provider: "google", hasProviderToken: true, hasProviderRefreshToken: false });

    expect(providerTokenPresence(null)).toBeNull();
  });

  it("stays quiet for password sign-ins, which have no provider tokens to note", () => {
    expect(providerTokenPresence({ user: { app_metadata: { provider: "email" } } })).toBeNull();
  });

  it("still records a session whose provider it cannot read", () => {
    expect(providerTokenPresence({ provider_refresh_token: "x" })).toEqual({
      provider: "unknown",
      hasProviderToken: false,
      hasProviderRefreshToken: true,
    });
  });
});
