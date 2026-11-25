import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  text: vi.fn(),
  template: vi.fn(),
  permission: vi.fn(),
  phoneCall: vi.fn(),
  whatsappCall: vi.fn(),
}));

vi.mock("@/lib/integrations/whatsapp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/whatsapp")>()),
  sendWhatsappText: m.text,
  sendWhatsappTemplate: m.template,
  getWhatsappCallPermission: m.permission,
}));
vi.mock("@/lib/integrations/elevenlabs", () => ({ placeOutboundCall: m.phoneCall, placeWhatsappCall: m.whatsappCall }));

import { isWithinServiceWindow, placeCheckinCall, sendProactiveWhatsapp } from "./whatsapp-outreach";
import { metaErrorCode, parseCallPermission, templateParam } from "@/lib/integrations/whatsapp";

type Link = { id: string; last_inbound_at: string | null; call_permission_requested_at: string | null };

/** Just enough of the Supabase query builder for nura_channel_links reads and updates. */
function fakeSupabase(link: Link | null) {
  const updates: Array<Record<string, unknown>> = [];
  const builder = () => {
    const chain: Record<string, unknown> = {};
    for (const name of ["select", "eq"]) chain[name] = () => chain;
    chain.limit = async () => ({ data: link ? [link] : [], error: null });
    chain.update = (values: Record<string, unknown>) => {
      updates.push(values);
      const done = { eq: () => done, then: (resolve: (v: unknown) => void) => resolve({ error: null }) };
      return done;
    };
    return chain;
  };
  return { client: { from: builder } as never, updates };
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const callInput = { toNumber: "+447000000000", dynamicVariables: { user_name: "Sam" }, allowWhatsapp: true, firstName: "Sam" };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WHATSAPP_ACCESS_TOKEN = "token";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "1163123896894809\n";
  process.env.ELEVENLABS_API_KEY = "key";
  delete process.env.NURA_WHATSAPP_CALLS;
  m.text.mockResolvedValue({ skipped: false });
  m.template.mockResolvedValue({ skipped: false });
  m.phoneCall.mockResolvedValue({ success: true, conversation_id: "conv_phone" });
  m.whatsappCall.mockResolvedValue({ success: true, conversation_id: "conv_wa" });
});

describe("messages Nura starts", () => {
  it("knows when Meta's 24h window is open", () => {
    expect(isWithinServiceWindow(hoursAgo(2))).toBe(true);
    expect(isWithinServiceWindow(hoursAgo(23.5))).toBe(false);
    expect(isWithinServiceWindow(null)).toBe(false);
  });

  it("sends the full text when the person wrote in the last day", async () => {
    const { client } = fakeSupabase({ id: "l1", last_inbound_at: hoursAgo(3), call_permission_requested_at: null });
    const result = await sendProactiveWhatsapp(client, "+44 7000 000000", "How did the walk go?", { firstName: "Sam", topic: "Morning walks" });
    expect(result).toEqual({ skipped: false, via: "text" });
    expect(m.text).toHaveBeenCalledWith("447000000000", "How did the walk go?");
    expect(m.template).not.toHaveBeenCalled();
  });

  it("sends the approved template when the window is closed or was never opened", async () => {
    for (const last of [hoursAgo(30), null]) {
      vi.clearAllMocks();
      m.template.mockResolvedValue({ skipped: false });
      const { client } = fakeSupabase({ id: "l1", last_inbound_at: last, call_permission_requested_at: null });
      const result = await sendProactiveWhatsapp(client, "447000000000", "How did the walk go?", { firstName: "Sam", topic: "Morning walks" });
      expect(result).toEqual({ skipped: false, via: "template" });
      expect(m.text).not.toHaveBeenCalled();
      expect(m.template).toHaveBeenCalledWith("447000000000", "nura_checkin", ["Sam", "Morning walks"]);
    }
  });

  it("falls back to the template when Meta says the window has closed", async () => {
    m.text.mockResolvedValue({ skipped: false, error: JSON.stringify({ error: { code: 131047, message: "Re-engagement message" } }) });
    const { client } = fakeSupabase({ id: "l1", last_inbound_at: hoursAgo(22.5), call_permission_requested_at: null });
    const result = await sendProactiveWhatsapp(client, "447000000000", "Hi", { firstName: "", topic: null });
    expect(result).toEqual({ skipped: false, via: "template" });
    expect(m.template).toHaveBeenCalledWith("447000000000", "nura_checkin", ["there", "how you've been"]);
  });

  it("reports other failures instead of hiding them behind a template", async () => {
    m.text.mockResolvedValue({ skipped: false, error: JSON.stringify({ error: { code: 131042, message: "payment" } }) });
    const { client } = fakeSupabase({ id: "l1", last_inbound_at: hoursAgo(1), call_permission_requested_at: null });
    const result = await sendProactiveWhatsapp(client, "447000000000", "Hi", { firstName: "Sam", topic: "x" });
    expect(result.error).toContain("131042");
    expect(m.template).not.toHaveBeenCalled();
  });

  it("cleans template variables and reads Meta error codes", () => {
    expect(templateParam("  Sleep\n routine \t after  job change ", "x")).toBe("Sleep routine after job change");
    expect(templateParam("", "there")).toBe("there");
    expect(templateParam("a".repeat(200), "x", 20)).toHaveLength(20);
    expect(metaErrorCode('{"error":{"code":131047}}')).toBe(131047);
    expect(metaErrorCode("(#131047) Re-engagement message")).toBe(131047);
    expect(metaErrorCode("nope")).toBeNull();
  });
});

describe("check-in calls", () => {
  const allowed = { status: "temporary", canStartCall: true, canRequest: false };
  const notYet = { status: "no_permission", canStartCall: false, canRequest: true };

  it("rings on WhatsApp when the person has allowed calls", async () => {
    m.permission.mockResolvedValue(allowed);
    const { client } = fakeSupabase({ id: "l1", last_inbound_at: null, call_permission_requested_at: null });
    const call = await placeCheckinCall(client, callInput);
    expect(call).toEqual({ conversation_id: "conv_wa", via: "whatsapp" });
    expect(m.whatsappCall).toHaveBeenCalledWith(
      expect.objectContaining({ whatsappUserId: "447000000000", whatsappPhoneNumberId: "1163123896894809", permissionTemplateName: "nura_call_permission" }),
    );
    expect(m.phoneCall).not.toHaveBeenCalled();
  });

  it("uses the phone line and asks once when calls aren't allowed yet", async () => {
    m.permission.mockResolvedValue(notYet);
    const { client, updates } = fakeSupabase({ id: "l1", last_inbound_at: null, call_permission_requested_at: null });
    const call = await placeCheckinCall(client, callInput);
    expect(call).toEqual({ conversation_id: "conv_phone", via: "phone" });
    await vi.waitFor(() => expect(m.template).toHaveBeenCalledWith("447000000000", "nura_call_permission", ["Sam"]));
    expect(updates[0]).toHaveProperty("call_permission_requested_at");
  });

  it("doesn't ask again within a month", async () => {
    m.permission.mockResolvedValue(notYet);
    const { client } = fakeSupabase({ id: "l1", last_inbound_at: null, call_permission_requested_at: hoursAgo(24 * 5) });
    await placeCheckinCall(client, callInput);
    await new Promise((r) => setTimeout(r, 10));
    expect(m.template).not.toHaveBeenCalled();
    expect(m.phoneCall).toHaveBeenCalledTimes(1);
  });

  it("falls back to the phone line when the WhatsApp call can't start", async () => {
    m.permission.mockResolvedValue(allowed);
    m.whatsappCall.mockRejectedValue(new Error("payment method"));
    const { client } = fakeSupabase({ id: "l1", last_inbound_at: null, call_permission_requested_at: null });
    expect(await placeCheckinCall(client, callInput)).toEqual({ conversation_id: "conv_phone", via: "phone" });
  });

  it("never uses WhatsApp for someone the owner cares for, an unlinked number, or when switched off", async () => {
    m.permission.mockResolvedValue(allowed);
    const linked = fakeSupabase({ id: "l1", last_inbound_at: null, call_permission_requested_at: null });
    expect((await placeCheckinCall(linked.client, { ...callInput, allowWhatsapp: false })).via).toBe("phone");
    expect((await placeCheckinCall(fakeSupabase(null).client, callInput)).via).toBe("phone");
    process.env.NURA_WHATSAPP_CALLS = "off";
    expect((await placeCheckinCall(linked.client, callInput)).via).toBe("phone");
    expect(m.whatsappCall).not.toHaveBeenCalled();
    expect(m.permission).not.toHaveBeenCalled();
  });

  it("reads Meta's permission answer", () => {
    expect(
      parseCallPermission({
        permission: { status: "temporary" },
        actions: [
          { action_name: "send_call_permission_request", can_perform_action: true },
          { action_name: "start_call", can_perform_action: true },
        ],
      }),
    ).toEqual({ status: "temporary", canStartCall: true, canRequest: false });
    expect(
      parseCallPermission({ permission: { status: "no_permission" }, actions: [{ action_name: "send_call_permission_request", can_perform_action: true }] }),
    ).toEqual({ status: "no_permission", canStartCall: false, canRequest: true });
    // Allowed, but today's call limit is used up.
    expect(parseCallPermission({ permission: { status: "permanent" }, actions: [{ action_name: "start_call", can_perform_action: false }] })?.canStartCall).toBe(false);
    expect(parseCallPermission(null)).toBeNull();
  });
});
