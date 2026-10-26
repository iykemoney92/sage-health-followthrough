import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDES, GUIDE_CATEGORIES, getGuide, relatedGuides } from "./index";

function visibleWords(guide: (typeof GUIDES)[number]) {
  const text = [
    guide.question,
    guide.answer,
    guide.why,
    ...guide.steps.flatMap((s) => [s.title, s.body]),
    ...guide.avoid,
    guide.nura,
    ...guide.faqs.flatMap((f) => [f.q, f.a]),
  ].join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

describe("guides", () => {
  it("has unique, URL-safe slugs", () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("only links related guides that exist", () => {
    for (const guide of GUIDES) {
      for (const slug of guide.related) expect(getGuide(slug), `${guide.slug} → ${slug}`).not.toBeNull();
      expect(guide.related).not.toContain(guide.slug);
      expect(relatedGuides(guide).length).toBeGreaterThan(0);
    }
  });

  it("keeps titles and descriptions inside search-result limits", () => {
    for (const guide of GUIDES) {
      // The layout appends " · Nura" (7 characters).
      expect(guide.title.length + 7, guide.slug).toBeLessThanOrEqual(60);
      expect(guide.description.length, guide.slug).toBeLessThanOrEqual(160);
    }
  });

  it("gives every page enough real content and an official source", () => {
    for (const guide of GUIDES) {
      expect(visibleWords(guide), guide.slug).toBeGreaterThanOrEqual(300);
      expect(guide.sources.length, guide.slug).toBeGreaterThan(0);
      for (const source of guide.sources) expect(source.url).toMatch(/^https:\/\/www\.nhs\.uk\//);
      expect(guide.steps.length).toBeGreaterThanOrEqual(4);
      expect(guide.faqs.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("files every guide under a known category", () => {
    const ids = new Set(GUIDE_CATEGORIES.map((c) => c.id));
    for (const guide of GUIDES) expect(ids.has(guide.category)).toBe(true);
  });

  it("lists every guide in llms.txt", () => {
    const llms = readFileSync(join(__dirname, "../../public/llms.txt"), "utf8");
    expect(llms).toContain("https://usenura.app/guides)");
    for (const guide of GUIDES) expect(llms, guide.slug).toContain(`https://usenura.app/guides/${guide.slug})`);
  });
});
