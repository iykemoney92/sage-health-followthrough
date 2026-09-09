import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The helper caches its verdict at module scope, so every case gets a fresh
// module and a fresh environment.
async function load() {
  vi.resetModules();
  return import("./shotstack");
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.SHOTSTACK_API_KEY;
  delete process.env.SHOTSTACK_BASE_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = ORIGINAL_ENV;
});

describe("getShotstackBaseUrl", () => {
  it("defaults to the production endpoint", async () => {
    const { getShotstackBaseUrl } = await load();
    expect(getShotstackBaseUrl()).toBe("https://api.shotstack.io/edit/v1");
  });

  it("strips a stray newline and trailing slashes — the value that once sent renders to '.../stage\\n/render'", async () => {
    process.env.SHOTSTACK_BASE_URL = "https://api.shotstack.io/edit/stage\n";
    const { getShotstackBaseUrl } = await load();
    expect(getShotstackBaseUrl()).toBe("https://api.shotstack.io/edit/stage");

    process.env.SHOTSTACK_BASE_URL = "https://api.shotstack.io/edit/v1//  ";
    const again = await load();
    expect(again.getShotstackBaseUrl()).toBe("https://api.shotstack.io/edit/v1");
  });
});

describe("shotstackIsUsable", () => {
  it("is false with no key and never touches the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { shotstackIsUsable } = await load();
    expect(await shotstackIsUsable()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is false when Shotstack rejects the key — a dead key must not choose the five-scene pipeline", async () => {
    process.env.SHOTSTACK_API_KEY = "revoked";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { shotstackIsUsable } = await load();
    expect(await shotstackIsUsable()).toBe(false);
  });

  it("is false when the probe throws or times out", async () => {
    process.env.SHOTSTACK_API_KEY = "whatever";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { shotstackIsUsable } = await load();
    expect(await shotstackIsUsable()).toBe(false);
  });

  it("is true on 200 and probes the configured base with the key header, then caches", async () => {
    process.env.SHOTSTACK_API_KEY = "  live-key  ";
    process.env.SHOTSTACK_BASE_URL = "https://api.shotstack.io/edit/v1/";
    const fetchSpy = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response("[]", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const { shotstackIsUsable } = await load();

    expect(await shotstackIsUsable()).toBe(true);
    expect(await shotstackIsUsable()).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0];
    if (!init) throw new Error("probe was made without request init");
    expect(url).toBe("https://api.shotstack.io/edit/v1/templates");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("live-key");
  });
});
