import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getGuide } from "./guides";
import { VIDEOS, isoDuration } from "./videos";

describe("videos", () => {
  it("points at files that exist and guides that exist", () => {
    for (const video of VIDEOS) {
      expect(existsSync(join(__dirname, "../public", video.src)), video.src).toBe(true);
      expect(existsSync(join(__dirname, "../public", video.poster)), video.poster).toBe(true);
      for (const g of video.guides) expect(getGuide(g), g).not.toBeNull();
      expect(video.seoTitle.length + 7, video.slug).toBeLessThanOrEqual(60);
      expect(video.description.length, video.slug).toBeLessThanOrEqual(160);
    }
  });

  it("keeps transcripts companion-first", () => {
    const text = JSON.stringify(VIDEOS).toLowerCase();
    expect(text).not.toMatch(/\bgp\b|blood pressure|doctor|clinic|medication|tablets/);
  });

  it("formats ISO durations", () => {
    expect(isoDuration(41)).toBe("PT41S");
    expect(isoDuration(153)).toBe("PT2M33S");
  });

  it("is listed in llms.txt", () => {
    const llms = readFileSync(join(__dirname, "../public/llms.txt"), "utf8");
    for (const video of VIDEOS) expect(llms).toContain(`https://usenura.app/videos/${video.slug})`);
  });
});
