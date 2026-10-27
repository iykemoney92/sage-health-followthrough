import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDES } from "@/lib/content/guides";
import { TOPICS } from "@/lib/content/topics";
import { TOOLS } from "@/lib/content/tools";

const root = join(import.meta.dirname, "../..");
const llms = readFileSync(join(root, "public/llms.txt"), "utf8");
const slugs = new Set([...GUIDES, ...TOPICS].map((guide) => guide.slug));

describe("free tools", () => {
  for (const tool of TOOLS) {
    describe(tool.slug, () => {
      it("is listed in llms.txt", () => {
        expect(llms).toContain(`https://useclariti.app/tools/${tool.slug})`);
      });
      it("is linked from guides that exist", () => {
        expect(tool.guides.length).toBeGreaterThanOrEqual(3);
        for (const slug of tool.guides) expect(slugs.has(slug), slug).toBe(true);
      });
      it("keeps its title and description within search-snippet length", () => {
        const page = readFileSync(join(root, `app/tools/${tool.slug}/page.tsx`), "utf8");
        const title = /const title = "([^"]+)"/.exec(page)?.[1] ?? "";
        const description = /const description =\s*"([^"]+)"/.exec(page)?.[1] ?? "";
        expect(title.length).toBeGreaterThan(0);
        expect(title.length).toBeLessThan(60);
        expect(description.length).toBeGreaterThan(0);
        expect(description.length).toBeLessThan(160);
      });
    });
  }
});
