import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDES } from "@/lib/content/guides";
import { TOPICS, TOPIC_CATEGORIES } from "@/lib/content/topics";

const ALL = [...GUIDES, ...TOPICS];
const slugs = new Set(ALL.map((guide) => guide.slug));
const llms = readFileSync(join(import.meta.dirname, "../../public/llms.txt"), "utf8");

function visibleWords(topic: (typeof TOPICS)[number]) {
  const text = [
    topic.h1,
    topic.answer,
    ...topic.why,
    ...topic.reading,
    ...(topic.example ? [topic.example.caption, topic.example.takeaway, ...topic.example.rows.flatMap((r) => [r.label, r.value, r.reading])] : []),
    ...topic.notMean,
    ...topic.whereSeen,
    ...topic.questions.flatMap((group) => [group.who, ...group.items]),
    topic.clariti,
    ...topic.faqs.flatMap((faq) => [faq.question, faq.answer]),
  ].join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

describe("guides content", () => {
  it("has unique slugs across both lists", () => {
    expect(slugs.size).toBe(ALL.length);
  });

  it("only links related guides that exist", () => {
    for (const guide of ALL) {
      for (const related of guide.related) expect(slugs.has(related), `${guide.slug} → ${related}`).toBe(true);
    }
  });

  it("lists every guide in llms.txt", () => {
    for (const guide of ALL) expect(llms).toContain(`https://useclariti.app/guides/${guide.slug})`);
  });

  for (const topic of TOPICS) {
    describe(topic.slug, () => {
      it("is a known category", () => {
        expect(TOPIC_CATEGORIES.map((c) => c.id)).toContain(topic.category);
      });
      it("keeps search snippets within length", () => {
        expect(topic.metaTitle.length).toBeLessThanOrEqual(60);
        expect(topic.metaDescription.length).toBeLessThanOrEqual(160);
      });
      it("cites official sources over https", () => {
        expect(topic.sources.length).toBeGreaterThan(0);
        for (const source of topic.sources) expect(source.url).toMatch(/^https:\/\//);
      });
      it("earns its place with at least 300 words", () => {
        expect(visibleWords(topic)).toBeGreaterThanOrEqual(300);
      });
      it("has FAQs for the FAQPage schema", () => {
        expect(topic.faqs.length).toBeGreaterThanOrEqual(3);
      });
    });
  }
});
