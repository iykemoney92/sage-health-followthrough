import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_FAQS, FAQ_GROUPS } from "@/lib/content/faq";

const llms = readFileSync(join(import.meta.dirname, "../../public/llms.txt"), "utf8");

describe("/faq content", () => {
  it("has 20–40 questions (SEO 1M playbook)", () => {
    expect(ALL_FAQS.length).toBeGreaterThanOrEqual(20);
    expect(ALL_FAQS.length).toBeLessThanOrEqual(40);
  });

  it("has no duplicate questions", () => {
    expect(new Set(ALL_FAQS.map((faq) => faq.question)).size).toBe(ALL_FAQS.length);
  });

  it("groups every question under a heading", () => {
    for (const group of FAQ_GROUPS) expect(group.items.length).toBeGreaterThan(0);
  });

  it("never names a price (the store shows the local one)", () => {
    for (const faq of ALL_FAQS) expect(faq.answer, faq.question).not.toMatch(/[$£€]\s?\d/);
  });

  it("is listed in llms.txt", () => {
    expect(llms).toContain("https://useclariti.app/faq)");
  });
});
