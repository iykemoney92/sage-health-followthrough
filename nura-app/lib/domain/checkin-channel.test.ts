import { describe, expect, it } from "vitest";
import { orderCheckinChannels, primaryCheckinChannel } from "./checkin-channel";

describe("primaryCheckinChannel", () => {
  it("prefers voice when allowed", () => {
    expect(primaryCheckinChannel(["whatsapp", "in_app", "voice"])).toBe("voice");
  });

  it("honours an explicit preferred when allowed", () => {
    expect(primaryCheckinChannel(["voice", "whatsapp"], "whatsapp")).toBe("whatsapp");
  });

  it("falls back when preferred is not allowed", () => {
    expect(primaryCheckinChannel(["whatsapp", "in_app"], "voice")).toBe("whatsapp");
  });
});

describe("orderCheckinChannels", () => {
  it("puts the preferred channel first", () => {
    expect(orderCheckinChannels(["whatsapp", "in_app", "voice"])).toEqual([
      "voice",
      "whatsapp",
      "in_app",
    ]);
  });
});
