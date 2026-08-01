import { describe, expect, it } from "vitest";
import { createWhatsappHref, createWhatsappLinkCode, extractWhatsappLinkCode, getNuraWhatsappNumber } from "./whatsapp-link";

describe("createWhatsappLinkCode", () => {
  it("produces a NURA-XXXXXXXX code with 8 uppercase hex characters", () => {
    const code = createWhatsappLinkCode();
    expect(code).toMatch(/^NURA-[A-F0-9]{8}$/);
  });

  it("produces distinct codes across calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => createWhatsappLinkCode()));
    expect(codes.size).toBe(20);
  });
});

describe("extractWhatsappLinkCode", () => {
  it("finds a link code embedded in free text", () => {
    expect(extractWhatsappLinkCode("Hi, link code: NURA-AB12CD34 please")).toBe("NURA-AB12CD34");
  });

  it("is case-insensitive but normalises to uppercase", () => {
    expect(extractWhatsappLinkCode("code nura-ab12cd34 here")).toBe("NURA-AB12CD34");
  });

  it("returns null when there is no code", () => {
    expect(extractWhatsappLinkCode("just a normal message, no code here")).toBeNull();
  });

  it("does not match malformed codes (wrong length)", () => {
    expect(extractWhatsappLinkCode("NURA-AB12 is too short")).toBeNull();
  });
});

describe("getNuraWhatsappNumber", () => {
  it("strips non-digit characters from the configured number", () => {
    const original = process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER;
    process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER = "+1 (253) 367-2877";
    expect(getNuraWhatsappNumber()).toBe("12533672877");
    process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER = original;
  });

  it("returns an empty string when unset", () => {
    const original = process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER;
    delete process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER;
    expect(getNuraWhatsappNumber()).toBe("");
    process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER = original;
  });
});

describe("createWhatsappHref", () => {
  it("returns null when no WhatsApp number is configured", () => {
    const original = process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER;
    delete process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER;
    expect(createWhatsappHref("NURA-AB12CD34")).toBeNull();
    process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER = original;
  });

  it("includes the link code in the generated wa.me URL", () => {
    process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER = "12533672877";
    const href = createWhatsappHref("NURA-AB12CD34");
    expect(href).toContain("https://wa.me/12533672877?text=");
    expect(decodeURIComponent(href ?? "")).toContain("Link code: NURA-AB12CD34");
  });

  it("rejects fictional US 555 placeholder numbers", () => {
    process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER = "15554859474";
    expect(createWhatsappHref("NURA-AB12CD34")).toBeNull();
  });
});
