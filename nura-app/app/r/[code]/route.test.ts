import { beforeEach, describe, expect, it, vi } from "vitest";

let sessionUserId: string | null = null;

vi.mock("@/lib/auth/supabase-admin", () => ({ getSupabaseAdminClient: vi.fn(() => ({})) }));
vi.mock("@/lib/integrations/supabase-server", () => ({
  getSessionUser: vi.fn(async () => (sessionUserId ? { id: sessionUserId } : null)),
}));
vi.mock("@/lib/referrals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/referrals")>();
  return {
    ...actual,
    lookupReferralCode: vi.fn(async (_admin: unknown, raw: string) =>
      raw === "ABCDEFGH" ? { code: "ABCDEFGH", ownerId: "owner", firstName: "Ike" } : null,
    ),
  };
});

const { GET } = await import("./route");
const { REFERRAL_COOKIE, REFERRAL_COOKIE_DAYS } = await import("@/lib/referrals");

let ip = 0;
async function open(code: string) {
  // A fresh address each time so the open-rate limit never kicks in between tests.
  ip += 1;
  const request = new Request(`https://usenura.app/r/${code}`, { headers: { "x-forwarded-for": `203.0.113.${ip}` } });
  return GET(request, { params: Promise.resolve({ code }) });
}

function inviteCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${REFERRAL_COOKIE}=`));
}

describe("GET /r/<code>", () => {
  beforeEach(() => {
    sessionUserId = null;
  });

  it("remembers the link for a signed-out visitor, for a week", async () => {
    const response = await open("ABCDEFGH");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/invited");
    const cookie = inviteCookie(response);
    expect(cookie).toContain(`${REFERRAL_COOKIE}=ABCDEFGH`);
    expect(cookie).toContain(`Max-Age=${REFERRAL_COOKIE_DAYS * 24 * 60 * 60}`);
    expect(REFERRAL_COOKIE_DAYS).toBe(7);
  });

  it("still remembers it when someone else is signed in", async () => {
    sessionUserId = "someone-else";
    const cookie = inviteCookie(await open("ABCDEFGH"));
    expect(cookie).toContain(`${REFERRAL_COOKIE}=ABCDEFGH`);
  });

  it("saves nothing, and clears any old invite cookie, when the owner opens their own link", async () => {
    sessionUserId = "owner";
    const response = await open("ABCDEFGH");
    expect(response.headers.get("location")).toBe("/invited?own=1");
    const cookie = inviteCookie(response);
    expect(cookie).toBeDefined();
    expect(cookie).not.toContain("ABCDEFGH");
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });

  it("sends an unknown code to the invalid page without a cookie", async () => {
    const response = await open("ZZZZZZZZ");
    expect(response.headers.get("location")).toBe("/invited?invalid=1");
    expect(inviteCookie(response)).toBeUndefined();
  });
});
