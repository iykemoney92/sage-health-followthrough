import { describe, expect, it } from "vitest";
import { providerOrder } from "./provider-order";

const ANDROID_APP =
  "Mozilla/5.0 (Linux; Android 14; SM-A145F Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

describe("providerOrder", () => {
  it("puts Google first on Android, including the Nura app's web view", () => {
    expect(providerOrder(ANDROID_APP)).toEqual(["google", "apple"]);
  });
  it("puts Google first on Windows and unknown devices", () => {
    expect(providerOrder(WINDOWS)).toEqual(["google", "apple"]);
    expect(providerOrder(null)).toEqual(["google", "apple"]);
  });
  it("keeps Apple first on iPhone and Mac", () => {
    expect(providerOrder(IPHONE)).toEqual(["apple", "google"]);
    expect(providerOrder(MAC)).toEqual(["apple", "google"]);
  });
  it("always offers both", () => {
    for (const ua of [ANDROID_APP, IPHONE, MAC, WINDOWS]) {
      expect(new Set(providerOrder(ua))).toEqual(new Set(["apple", "google"]));
    }
  });
});
