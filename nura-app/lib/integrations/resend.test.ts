import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPTOUT_TOPIC_ID } from "@/lib/integrations/optout";
import { checkInReminderEmailHtml, sendAuthEmail } from "@/lib/integrations/resend";

const html = checkInReminderEmailHtml({
  workspaceUrl: "https://usenura.app/workspace",
  scheduledFor: "2026-11-02T10:00:00Z",
  planTitle: "Blood pressure",
  channel: "voice",
});

type SentBody = { topic_id?: string; reply_to?: string; headers: Record<string, string>; html: string; text: string };

function captureSends() {
  const sent: { key: string; body: SentBody }[] = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    sent.push({ key: headers.Authorization, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ id: "email_1" }), { status: 200 });
  });
  return sent;
}

describe("sendAuthEmail and the Zapx opt-out list", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_nura");
    vi.stubEnv("RESEND_OPTOUT_API_KEY", "re_zapx");
    vi.stubEnv("OPTOUT_TOKEN_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends a reminder through the Zapx account with the topic, one-click headers and a footer link", async () => {
    const sent = captureSends();
    await sendAuthEmail({ to: "ada@example.com", subject: "Check-in", html, text: "Hi\n", optOut: true });
    const { key, body } = sent[0]!;
    expect(key).toBe("Bearer re_zapx");
    expect(body.topic_id).toBe(OPTOUT_TOPIC_ID);
    expect(body.reply_to).toBe("hi@zapxlabs.com");
    expect(body.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const url = /<(https:\/\/unsubscribe\.zapxlabs\.com\/u\/[^>]+)>, <mailto:hi@zapxlabs\.com\?subject=unsubscribe>/.exec(
      body.headers["List-Unsubscribe"],
    )?.[1];
    expect(url).toBeTruthy();
    expect(body.html).toContain(`<a href="${url}"`);
    expect(body.text).toContain(`Unsubscribe: ${url}`);
  });

  it("leaves account emails alone: Nura's own key, no topic, no unsubscribe line", async () => {
    const sent = captureSends();
    await sendAuthEmail({ to: "ada@example.com", subject: "Reset", html, text: "Hi\n" });
    const { key, body } = sent[0]!;
    expect(key).toBe("Bearer re_nura");
    expect(body.topic_id).toBeUndefined();
    expect(body.html).not.toContain("<!--unsubscribe-->");
    expect(body.html).not.toContain("Unsubscribe");
  });

  it("sends reminders as before until the Zapx key is set", async () => {
    vi.stubEnv("RESEND_OPTOUT_API_KEY", "");
    const sent = captureSends();
    await sendAuthEmail({ to: "ada@example.com", subject: "Check-in", html, text: "Hi\n", optOut: true });
    expect(sent[0]!.key).toBe("Bearer re_nura");
    expect(sent[0]!.body.topic_id).toBeUndefined();
  });
});
