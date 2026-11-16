import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAQ_COUNT, FAQ_GROUPS } from "./faq";

describe("faq", () => {
  it("has 20 to 40 unique questions with real answers", () => {
    expect(FAQ_COUNT).toBeGreaterThanOrEqual(20);
    expect(FAQ_COUNT).toBeLessThanOrEqual(40);
    const qs = FAQ_GROUPS.flatMap((g) => g.items.map((i) => i.q));
    expect(new Set(qs).size).toBe(qs.length);
    for (const g of FAQ_GROUPS) for (const i of g.items) {
      expect(i.q.endsWith("?"), i.q).toBe(true);
      expect(i.a.split(/\s+/).length, i.q).toBeGreaterThanOrEqual(12);
    }
  });

  it("keeps companion framing: no dose advice wording", () => {
    const text = FAQ_GROUPS.flatMap((g) => g.items.map((i) => i.a)).join(" ").toLowerCase();
    expect(text).not.toMatch(/you should take|double (up|dose)|increase your dose|reduce your dose/);
  });

  it("is listed in llms.txt and the sitemap", () => {
    expect(readFileSync(join(__dirname, "../public/llms.txt"), "utf8")).toContain("https://usenura.app/faq)");
    expect(readFileSync(join(__dirname, "../app/sitemap.ts"), "utf8")).toContain("${appUrl}/faq");
  });
});
