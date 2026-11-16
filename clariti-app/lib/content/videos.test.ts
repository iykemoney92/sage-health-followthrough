import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VIDEOS } from "@/lib/content/videos";

const llms = readFileSync(join(import.meta.dirname, "../../public/llms.txt"), "utf8");

function isoSeconds(iso: string) {
  const match = /^PT(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) throw new Error(`not an ISO 8601 duration: ${iso}`);
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

describe("/videos watch pages", () => {
  for (const video of VIDEOS) {
    describe(video.slug, () => {
      it("has an ISO duration that matches its seconds", () => {
        expect(isoSeconds(video.isoDuration)).toBe(video.seconds);
      });
      it("keeps the title within snippet length", () => {
        expect(video.metaTitle.length).toBeLessThanOrEqual(60);
      });
      it("serves media over https", () => {
        expect(video.src).toMatch(/^https:\/\/.+\.mp4$/);
        expect(video.poster).toMatch(/^https:\/\//);
      });
      it("has a YouTube id in the right shape", () => {
        expect(video.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
      });
      it("has a transcript", () => {
        expect(video.transcript.length).toBeGreaterThan(0);
      });
      it("is listed in llms.txt", () => {
        expect(llms).toContain(`https://useclariti.app/videos/${video.slug})`);
      });
    });
  }
});
