import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-path";

/**
 * Every case here is a real way a `next` value has been used to smuggle an
 * off-site destination past a naive prefix check, so they are written as the
 * attacker would send them rather than tidied into representative shapes.
 */
describe("safeNextPath", () => {
  it("keeps an ordinary in-app path, query and hash included", () => {
    expect(safeNextPath("/workspace")).toBe("/workspace");
    expect(safeNextPath("/history?filter=bills#top")).toBe("/history?filter=bills#top");
  });

  it("falls back when there is nothing to route on", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("   ", "/auth/confirm")).toBe("/auth/confirm");
  });

  it("rejects protocol-relative paths", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("//evil.com/steal")).toBe("/");
    expect(safeNextPath("///evil.com")).toBe("/");
  });

  it("rejects absolute URLs whatever the scheme", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("http://evil.com/next")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("data:text/html,<script>alert(1)</script>")).toBe("/");
  });

  it("rejects backslashes, which browsers treat as path separators", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("\\\\evil.com")).toBe("/");
    expect(safeNextPath("/workspace\\..\\..")).toBe("/");
  });

  it("rejects values that only look relative until they are decoded", () => {
    expect(safeNextPath("/%2f%2fevil.com")).toBe("/");
    expect(safeNextPath("%2f%2fevil.com")).toBe("/");
    expect(safeNextPath("/%5c%5cevil.com")).toBe("/");
    // A lone percent throws in decodeURIComponent rather than decoding.
    expect(safeNextPath("/%")).toBe("/");
  });

  it("rejects a leading control character the parser strips before resolving", () => {
    // The tab is removed before parsing, so "/\t//evil.com" starts with a single
    // slash on inspection and still resolves to https://evil.com.
    expect(safeNextPath("/\t//evil.com")).toBe("/");
    expect(safeNextPath("/\n//evil.com")).toBe("/");
    expect(safeNextPath("/\r//evil.com")).toBe("/");
  });

  it("hands back the parser's reading, not the raw input", () => {
    expect(safeNextPath("/workspace/../history")).toBe("/history");
  });

  it("honours the caller's fallback for every rejection", () => {
    expect(safeNextPath("//evil.com", "/auth/confirm")).toBe("/auth/confirm");
    expect(safeNextPath("https://evil.com", "")).toBe("");
  });
});
