import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  fitWithinLongEdge,
  formatFileSize,
  isPdfFile,
  oversizeUploadMessage,
  readDocumentApiResponse,
} from "./document-upload";

const MB = 1024 * 1024;

describe("fitWithinLongEdge", () => {
  it("leaves a page that already fits alone", () => {
    expect(fitWithinLongEdge(1600, 1200)).toEqual({ width: 1600, height: 1200 });
  });

  it("scales the long edge down and keeps the aspect ratio", () => {
    expect(fitWithinLongEdge(4032, 3024)).toEqual({ width: 2200, height: 1650 });
  });

  it("scales by height when the photo is portrait", () => {
    expect(fitWithinLongEdge(3024, 4032)).toEqual({ width: 1650, height: 2200 });
  });

  it("never rounds a very thin page down to zero", () => {
    expect(fitWithinLongEdge(11000, 3)).toEqual({ width: 2200, height: 1 });
  });

  it("returns the input unchanged when the dimensions are not usable", () => {
    expect(fitWithinLongEdge(0, 0)).toEqual({ width: 0, height: 0 });
    expect(fitWithinLongEdge(Number.NaN, 100)).toEqual({ width: Number.NaN, height: 100 });
  });
});

describe("oversizeUploadMessage", () => {
  it("passes a file inside the limit", () => {
    expect(oversizeUploadMessage({ name: "bill.pdf", type: "application/pdf", size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it("names the size and the limit for an oversize PDF", () => {
    const message = oversizeUploadMessage({ name: "bill.pdf", type: "application/pdf", size: 9 * MB });
    expect(message).toContain("9.0MB");
    expect(message).toContain("4.0MB");
    expect(message).toContain("fewer pages");
  });

  it("suggests a smaller photo rather than fewer pages for an image", () => {
    const message = oversizeUploadMessage({ name: "photo.heic", type: "image/heic", size: 12 * MB });
    expect(message).toContain("smaller photo");
    expect(message).not.toContain("fewer pages");
  });
});

describe("isPdfFile", () => {
  it("recognises a PDF by extension when the browser sends no type", () => {
    expect(isPdfFile({ name: "eob.PDF", type: "" })).toBe(true);
    expect(isPdfFile({ name: "eob.png", type: "image/png" })).toBe(false);
  });
});

describe("formatFileSize", () => {
  it("uses MB above a megabyte and KB below it", () => {
    expect(formatFileSize(4 * MB)).toBe("4.0MB");
    expect(formatFileSize(180 * 1024)).toBe("180KB");
    expect(formatFileSize(12)).toBe("1KB");
  });
});

describe("readDocumentApiResponse", () => {
  it("reads a 413 as a size problem, because the edge writes it and it is not JSON", async () => {
    const payload = await readDocumentApiResponse(new Response("Request Entity Too Large", { status: 413 }));
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("too large");
  });

  it("returns the route's own JSON error untouched", async () => {
    const response = new Response(JSON.stringify({ ok: false, error: "Use a file smaller than 4MB." }), { status: 400 });
    expect(await readDocumentApiResponse(response)).toEqual({ ok: false, error: "Use a file smaller than 4MB." });
  });

  it("falls back to a readable message when the body is not JSON at all", async () => {
    const payload = await readDocumentApiResponse(new Response("<html>gateway</html>", { status: 502 }));
    expect(payload.ok).toBe(false);
    expect(payload.error).toContain("Clariti could not read this document");
  });

  it("passes a successful extraction through", async () => {
    const response = new Response(JSON.stringify({ ok: true, extractedText: "FINDINGS: normal" }), { status: 200 });
    expect(await readDocumentApiResponse(response)).toMatchObject({ ok: true, extractedText: "FINDINGS: normal" });
  });
});
