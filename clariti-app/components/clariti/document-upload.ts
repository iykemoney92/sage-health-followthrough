/**
 * Client-side preparation for the two document endpoints.
 *
 * Vercel refuses a request body over 4.5MB at the edge, before the function runs, and
 * answers with a plain-text 413. The route's own size check therefore never sees the
 * file, and the client's `response.json()` throws on the non-JSON body — which is why
 * every oversize upload surfaced as "Could not read that document." with no hint that
 * size was the problem. Phone photos of a bill clear 4.5MB routinely.
 *
 * So images are shrunk here until they fit, PDFs (which cannot be shrunk this way) are
 * refused up front with a message that names the real problem, and a 413 that still gets
 * through is read as a size error rather than as unreadable JSON.
 */

import {
  MAX_UPLOAD_BYTES,
  isImageFile,
  oversizeUploadMessage,
  uploadTooLargeMessage,
} from "@/lib/domain/clariti-uploads";

// The cap and its copy are shared with both document routes, so they live in the domain
// layer; what stays here is the half that needs a browser.
export {
  MAX_UPLOAD_BYTES,
  formatFileSize,
  isImageFile,
  isPdfFile,
  oversizeUploadMessage,
  uploadTooLargeMessage,
} from "@/lib/domain/clariti-uploads";

/** Long edge kept when a photo is downscaled — still legible to OCR for a printed page. */
export const MAX_IMAGE_LONG_EDGE = 2200;

const JPEG_QUALITY = 0.82;

export type DocumentApiPayload = {
  ok?: boolean;
  error?: string;
  extractedText?: string;
  extractionMethod?: string;
  document?: { id?: string };
};

export type PreparedDocument =
  | { ok: true; file: File }
  | { ok: false; error: string };

/**
 * Fit a page into the long-edge budget, preserving aspect ratio. Anything already
 * inside it is returned untouched — upscaling a small scan only adds bytes.
 */
export function fitWithinLongEdge(width: number, height: number, longEdge = MAX_IMAGE_LONG_EDGE) {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0) return { width, height };
  if (longest <= longEdge) return { width, height };

  const scale = longEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Shrink what can be shrunk, refuse what cannot, and hand back the file to actually send. */
export async function prepareDocumentForUpload(file: File): Promise<PreparedDocument> {
  const prepared = isImageFile(file) ? await downscaleImage(file) : file;
  const tooLarge = oversizeUploadMessage(prepared);
  return tooLarge ? { ok: false, error: tooLarge } : { ok: true, file: prepared };
}

/**
 * Read a response from /api/documents/*. The 413 branch matters: that status is written
 * by the edge, not by the route, so its body is not JSON and parsing it loses the only
 * fact worth reporting.
 */
export async function readDocumentApiResponse(response: Response): Promise<DocumentApiPayload> {
  if (response.status === 413) return { ok: false, error: uploadTooLargeMessage() };

  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text) as DocumentApiPayload;
  } catch {
    return {
      ok: false,
      error: response.ok
        ? "Clariti received an unreadable server response. Please try again."
        : "Clariti could not read this document. Try a clearer PDF or photo, a text-based PDF, or paste the report text.",
    };
  }
}

async function downscaleImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;

  try {
    const source = await loadImage(file);
    const naturalWidth = "naturalWidth" in source ? source.naturalWidth : source.width;
    const naturalHeight = "naturalHeight" in source ? source.naturalHeight : source.height;
    const { width, height } = fitWithinLongEdge(naturalWidth, naturalHeight);

    // Already small in both senses: re-encoding would only lose detail.
    if (width === naturalWidth && height === naturalHeight && file.size <= MAX_UPLOAD_BYTES) {
      releaseImage(source);
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      releaseImage(source);
      return file;
    }

    context.drawImage(source, 0, 0, width, height);
    releaseImage(source);

    const blob = await canvasToBlob(canvas);
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], jpegFileName(file.name), { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    // A format this browser cannot decode — HEIC outside Safari, a truncated download —
    // goes up unchanged. oversizeUploadMessage still catches it if it is too big, so the
    // failure is a plain message rather than an edge rejection.
    return file;
  }
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // imageOrientation is stated rather than left to the engine. A phone photo of a
  // bill is routinely stored landscape with an orientation tag, and the canvas
  // re-encode below drops the tag — so on any engine still defaulting to "none"
  // the upload would arrive rotated with nothing left to correct it, and the
  // vision extraction would read a sideways page. The HTMLImageElement fallback
  // is already orientation-correct.
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("The browser could not decode this image."));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function releaseImage(source: ImageBitmap | HTMLImageElement) {
  if ("close" in source) source.close();
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
  });
}

function jpegFileName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return `${base || "document"}.jpg`;
}
