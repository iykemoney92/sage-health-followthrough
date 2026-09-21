import { describe, expect, it } from "vitest";
import {
  CONNECTION_SOURCES,
  getConnectionSource,
  isUsableAvailability,
  missingConnectionEnv,
  resolveAvailability,
  resolveConnectionSources,
  type ConnectionEnv,
  type ConnectionMarket,
  type ConnectionSource,
} from "./registry";

const NOTHING_CONFIGURED: ConnectionEnv = {};
const BLUE_BUTTON_CONFIGURED: ConnectionEnv = {
  CMS_BLUE_BUTTON_CLIENT_ID: "client-id",
  CMS_BLUE_BUTTON_CLIENT_SECRET: "client-secret",
};

const MARKETS: (ConnectionMarket | undefined)[] = [undefined, "any", "us", "uk"];

function ids(sources: { id: string }[]) {
  return sources.map((source) => source.id);
}

describe("the universal source", () => {
  // Upload is the one thing that can never be unavailable: no vendor, no
  // credentials, no covered-entity status. If it ever drops out of a list, the
  // person is left with nothing, so it is pinned in every combination.
  it("is returned in every market, every configuration, and both audiences", () => {
    for (const market of MARKETS) {
      for (const env of [NOTHING_CONFIGURED, BLUE_BUTTON_CONFIGURED]) {
        for (const audience of ["user", "operator"] as const) {
          const resolved = resolveConnectionSources(env, { market, audience });
          expect(ids(resolved)).toContain("upload");
          const upload = resolved.find((source) => source.id === "upload");
          expect(upload?.availability).toEqual({ state: "ready" });
        }
      }
    }
  });
});

describe("an unconfigured connector", () => {
  it("is hidden from the user even in its own market", () => {
    const seen = resolveConnectionSources(NOTHING_CONFIGURED, { market: "us" });
    expect(ids(seen)).not.toContain("cms_blue_button");
    // And not as "coming soon" either: it is absent, not present-and-greyed.
    expect(seen.every((source) => isUsableAvailability(source.availability))).toBe(true);
  });

  it("is visible to an operator, and names the variables it is waiting on", () => {
    const seen = resolveConnectionSources(NOTHING_CONFIGURED, {
      market: "us",
      audience: "operator",
    });
    const blueButton = seen.find((source) => source.id === "cms_blue_button");
    expect(blueButton?.availability).toEqual({
      state: "unconfigured",
      missing: ["CMS_BLUE_BUTTON_CLIENT_ID", "CMS_BLUE_BUTTON_CLIENT_SECRET"],
    });
  });

  it("names only the variable that is actually absent", () => {
    const half: ConnectionEnv = { CMS_BLUE_BUTTON_CLIENT_ID: "client-id" };
    expect(missingConnectionEnv(half)).toEqual({
      cms_blue_button: ["CMS_BLUE_BUTTON_CLIENT_SECRET"],
    });
  });

  // Shotstack shipped with a base URL that was a stray newline and read as
  // configured. A blank value is not a value.
  it("treats a whitespace-only value as absent", () => {
    const blank: ConnectionEnv = {
      CMS_BLUE_BUTTON_CLIENT_ID: "  ",
      CMS_BLUE_BUTTON_CLIENT_SECRET: "\n",
    };
    expect(missingConnectionEnv(blank)).toEqual({
      cms_blue_button: ["CMS_BLUE_BUTTON_CLIENT_ID", "CMS_BLUE_BUTTON_CLIENT_SECRET"],
    });
    expect(ids(resolveConnectionSources(blank, { market: "us" }))).not.toContain("cms_blue_button");
  });

  it("becomes ready, and reaches users, once an operator sets both", () => {
    expect(missingConnectionEnv(BLUE_BUTTON_CONFIGURED)).toEqual({});
    const seen = resolveConnectionSources(BLUE_BUTTON_CONFIGURED, { market: "us" });
    const blueButton = seen.find((source) => source.id === "cms_blue_button");
    expect(blueButton?.availability).toEqual({ state: "ready" });
  });
});

describe("market filtering", () => {
  it("sends a UK viewer to the NHS App and not to a US portal", () => {
    const seen = ids(resolveConnectionSources(NOTHING_CONFIGURED, { market: "uk" }));
    expect(seen).toContain("nhs_app_download");
    expect(seen).not.toContain("patient_portal_download");
    expect(seen).not.toContain("cms_blue_button");
  });

  it("sends a US viewer to their portal and not to the NHS App", () => {
    const seen = ids(resolveConnectionSources(NOTHING_CONFIGURED, { market: "us" }));
    expect(seen).toContain("patient_portal_download");
    expect(seen).not.toContain("nhs_app_download");
  });

  // We would rather show a UK person one route that is not theirs than hide the
  // one that is. Guessing a market silently is the same failure as guessing a
  // severity: confident output with nothing behind it.
  it("returns every market's routes when the viewer's market is unknown", () => {
    const seen = ids(resolveConnectionSources(NOTHING_CONFIGURED));
    expect(seen).toEqual(expect.arrayContaining([
      "upload",
      "nhs_app_download",
      "patient_portal_download",
    ]));
  });
});

describe("a structurally closed source", () => {
  // Nothing closed ships today, so the catalogue is injected: the NHS shut
  // patient-facing record access to third parties, and no env var reopens it.
  const CLOSED: readonly ConnectionSource[] = [
    {
      id: "nhs_record_api",
      name: "NHS record access",
      description: "Your NHS record, without you fetching anything.",
      documentKinds: ["lab_results"],
      market: "uk",
      transport: {
        via: "closed",
        reason: "The NHS has closed its patient-facing API to third parties.",
      },
    },
  ];

  it("resolves to unavailable with the reason, and no credential can change that", () => {
    expect(resolveAvailability(CLOSED[0], BLUE_BUTTON_CONFIGURED)).toEqual({
      state: "unavailable",
      reason: "The NHS has closed its patient-facing API to third parties.",
    });
  });

  it("is hidden from users and shown to operators", () => {
    expect(resolveConnectionSources(NOTHING_CONFIGURED, { sources: CLOSED })).toEqual([]);
    const operatorView = resolveConnectionSources(NOTHING_CONFIGURED, {
      sources: CLOSED,
      audience: "operator",
    });
    expect(ids(operatorView)).toEqual(["nhs_record_api"]);
  });
});

describe("the shipped catalogue", () => {
  // The guard the page hangs on: with nothing configured, a user must never be
  // offered a connection that does not exist.
  it("offers users nothing but ready or guided sources in any market", () => {
    for (const market of MARKETS) {
      const seen = resolveConnectionSources(NOTHING_CONFIGURED, { market });
      expect(seen.length).toBeGreaterThan(0);
      for (const source of seen) {
        expect(["ready", "guided"]).toContain(source.availability.state);
      }
    }
  });

  it("keeps ids unique, because they are persisted", () => {
    const seen = CONNECTION_SOURCES.map((source) => source.id);
    expect(new Set(seen).size).toBe(seen.length);
  });

  // A guided route is a real path only if we tell the person the steps.
  it("gives every guided source steps to follow", () => {
    for (const source of CONNECTION_SOURCES) {
      const transport = source.transport;
      if (transport.via !== "self_serve") continue;
      expect(resolveAvailability(source, NOTHING_CONFIGURED)).toEqual({ state: "guided" });
      expect(transport.steps.length).toBeGreaterThan(1);
    }
  });

  it("looks a source up by its persisted id", () => {
    expect(getConnectionSource("upload")?.name).toBe("Upload or take a photo");
    expect(getConnectionSource("healthkit")).toBeUndefined();
  });
});
