import { anthropic } from "@ai-sdk/anthropic";
import { generateText, uploadFile } from "ai";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 12 * 1024 * 1024;

/**
 * What Clariti can actually read. Anything else reaches a vision model that will
 * happily try, and bill for the attempt.
 */
const ACCEPTED_MIME_TYPES = new Set([
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: NextRequest) {
  // This route sends whatever it is given to a vision model. Without a session
  // check it was an open, unauthenticated OCR endpoint that anyone on the
  // internet could point at, billed to Clariti's provider account.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit(await getSupabaseSessionClient(), "extract");
  if (limited) return limited;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "A document file is required." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ ok: false, error: "Use a file smaller than 12MB." }, { status: 400 });
    }

    const type = file.type || inferMimeType(file.name);

    // Checked before any provider call, so an unsupported upload costs nothing.
    if (!ACCEPTED_MIME_TYPES.has(type)) {
      return NextResponse.json({
        ok: false,
        error: "Clariti can read text files, PDFs, and photos or scans (PNG, JPG, WEBP, HEIC).",
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
      return extracted(await file.text(), "text");
    }

    if (type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const text = await extractWithAiFile(buffer, type, file.name);
        return extracted(text, "pdf");
      } catch {
        const result = await extractPdfText(buffer);
        return extracted(result.text, result.method);
      }
    }

    if (type.startsWith("image/")) {
      const text = await extractWithAiFile(buffer, type, file.name);
      return extracted(text, "image_vision");
    }

    // Unreachable: ACCEPTED_MIME_TYPES above admits only text, PDF and images,
    // and each is handled. Kept as a total return rather than a throw so a future
    // addition to that set fails as a 400 rather than a 500.
    return NextResponse.json({
      ok: false,
      error: "Clariti can read text files, PDFs, and photos or scans (PNG, JPG, WEBP, HEIC).",
    }, { status: 400 });
  } catch (error) {
    // Only the error's own message, never the caught object: a provider error can
    // carry echoed request content, and the request content here is somebody's
    // medical document.
    console.error(
      "[clariti] document extraction failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({
      ok: false,
      error: friendlyExtractionError(error),
    }, { status: 422 });
  }
}

type ExtractionMethod = "text" | "pdf" | "pdf_vision" | "image_vision";

function extracted(text: string, extractionMethod: ExtractionMethod) {
  const extractedText = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!hasEnoughDocumentSignal(extractedText)) {
    return NextResponse.json({
      ok: false,
      error: "Clariti could not find enough readable report text. Try a clearer scan, upload an image/PDF with readable text, or paste the report text.",
    }, { status: 422 });
  }

  return NextResponse.json({
    ok: true,
    extractedText,
    extractionMethod,
    charCount: extractedText.length,
  });
}

async function extractWithAiFile(buffer: Buffer, mimeType: string, filename: string) {
  if (mimeType.startsWith("image/") && (process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY)) {
    return extractWithVisionImages([{ data: buffer, mediaType: mimeType }], filename);
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Provider file upload is not configured.");

  const uploaded = await uploadFile({
    api: anthropic,
    data: buffer,
    mediaType: mimeType,
    filename,
  });

  const result = await generateText({
    model: anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929"),
    temperature: 0,
    maxOutputTokens: 2400,
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: "Extract the readable text from this health document. Return only text present in the document. Preserve useful line breaks. Do not summarize, diagnose, or infer missing words.",
        },
        {
          type: "file",
          mediaType: mimeType,
          filename,
          data: { type: "reference", reference: uploaded.providerReference },
        },
      ],
    }],
  });

  return result.text;
}

async function extractPdfText(buffer: Buffer) {
  const { PDFParse } = await import("pdf-parse");
  PDFParse.setWorker(path.join(process.cwd(), "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs"));
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    if (hasEnoughDocumentSignal(parsed.text)) return { text: parsed.text, method: "pdf" as const };

    const screenshots = await parser.getScreenshot({
      desiredWidth: 1400,
      first: Math.min(parsed.total ?? 4, 4),
    });
    const pages = screenshots.pages
      .filter((page) => page.data?.length)
      .map((page) => ({
        data: Buffer.from(page.data),
        mediaType: "image/png",
        pageNumber: page.pageNumber,
      }));

    if (!pages.length) return { text: parsed.text, method: "pdf" as const };
    return { text: await extractWithVisionImages(pages, "rendered PDF pages"), method: "pdf_vision" as const };
  } finally {
    await parser.destroy();
  }
}

function friendlyExtractionError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/Provider file upload is not configured|AI Gateway|Anthropic/i.test(message)) {
    return "Clariti could not read this PDF/image because document vision is not configured in production. Try a text-based PDF, a .txt file, or paste the report text.";
  }
  if (/timeout|aborted|duration|exceeded/i.test(message)) {
    return "Document reading took too long. Try a smaller or clearer PDF/image, or paste the report text.";
  }
  return "Clariti could not extract readable text from this document. Try a clearer PDF/image, a text-based PDF, or paste the report text.";
}

async function extractWithVisionImages(
  images: Array<{ data: Buffer; mediaType: string; pageNumber?: number }>,
  filename: string,
) {
  const hasGatewayAuth = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!hasGatewayAuth && !hasAnthropicKey) {
    throw new Error("Scanned PDF and image reading needs Vercel AI Gateway or Anthropic configured.");
  }

  const result = await generateText({
    model: hasGatewayAuth
      ? process.env.AI_GATEWAY_VISION_MODEL ?? process.env.AI_GATEWAY_MODEL ?? "anthropic/claude-sonnet-4.6"
      : anthropic(process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5-20250929"),
    temperature: 0,
    maxOutputTokens: 6000,
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text:
            `Extract the readable text from this health document image/PDF (${filename}). ` +
            "Return only text that is visibly present in the pages. Preserve section headings such as PROCEDURE, FINDINGS, IMPRESSION, CONCLUSION, DIAGNOSIS, CHARGES, PATIENT RESPONSIBILITY, REFERENCE RANGE, MEDICATIONS, PLAN, FOLLOW-UP, DISCHARGE, AUTHORIZATION, or REFERRAL. " +
            "Do not summarize, diagnose, calculate, or infer missing words. If a page has no readable clinical/document text, write [no readable text on page].",
        },
        ...images.flatMap((image) => [
          {
            type: "text" as const,
            text: image.pageNumber ? `Page ${image.pageNumber}:` : "Image:",
          },
          {
            type: "file" as const,
            mediaType: image.mediaType,
            data: image.data,
          },
        ]),
      ],
    }],
  });

  return result.text;
}

function hasEnoughDocumentSignal(text: string) {
  const normalized = text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, " ")
    .replace(/\bpage\s+\d+\s+of\s+\d+\b/gi, " ")
    .replace(/\[no readable text on page\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length < 80) return false;
  if (normalized.split(/\s+/).filter((word) => /[a-z]{3,}/i.test(word)).length < 12) return false;

  return /findings|impression|conclusion|procedure|exam|study|patient|provider|amount|charges|claim|diagnosis|technique|comparison|indications/i.test(normalized);
}

function inferMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "application/octet-stream";
}
