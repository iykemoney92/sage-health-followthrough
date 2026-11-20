import { describe, expect, it } from "vitest";
import { decodePendingConfirmCookie, encodePendingConfirmCookie } from "./pending-confirm";

describe("pending-confirm cookie", () => {
  it("round-trips the user id so the poll can read the account without minting a link", () => {
    const raw = encodePendingConfirmCookie("a@example.com", "tok", "user-1");
    expect(decodePendingConfirmCookie(raw)).toEqual({ email: "a@example.com", token: "tok", userId: "user-1" });
  });
  it("still reads cookies written before the user id existed", () => {
    const legacy = Buffer.from(JSON.stringify({ email: "a@example.com", token: "tok" }), "utf8").toString("base64url");
    expect(decodePendingConfirmCookie(legacy)).toEqual({ email: "a@example.com", token: "tok", userId: null });
  });
  it("leaves the user id out when there isn't one", () => {
    const raw = encodePendingConfirmCookie("a@example.com", "tok");
    expect(decodePendingConfirmCookie(raw)?.userId).toBeNull();
  });
  it("rejects junk", () => {
    expect(decodePendingConfirmCookie("not-base64-json")).toBeNull();
    expect(decodePendingConfirmCookie(undefined)).toBeNull();
  });
});
