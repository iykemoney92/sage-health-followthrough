import { anthropic } from "@ai-sdk/anthropic";
import { generateText, uploadFile } from "ai";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { enforceRateLimit } from "@/lib/rate-limit";
import { MAX_UPLOAD_BYTES, uploadSizeLimitError } from "@/lib/domain/clariti-uploads";
import { aiConsentRequiredResponse, hasAiConsent } from "@/lib/ai-consent";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { reportError } from "@/lib/observability/report-error";

export const runtime = "nodejs";
export const maxDuration = 60;

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

/**
 * Pages rendered for vision when a PDF's own text layer is unreadable. Raising this
 * multiplies the vision cost of every scanned upload, so what is fixed here instead is
 * the silence: the response reports how much of the document was actually read.
 */
const MAX_VISION_PAGES = 4;

export async function POST(request: NextRequest) {
  // This route sends whatever it is given to a vision model. Without a session
  // check it was an open, unauthenticated OCR endpoint that anyone on the
  // internet could point at, billed to Clariti's provider account.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!hasAiConsent(user)) {
    return aiConsentRequiredResponse();
  }

  const limited = await enforceRateLimit(await getSupabaseSessionClient(), "extract");
  if (limited) return limited;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "A document file is required." }, { status: 400 });
    }

    // Vercel refuses a body over 4.5MB at the edge, before this function is invoked, so
    // anything much larger never reaches this check — it comes back as a plain-text 413.
    // This fires only in the band between what Clariti advertises and what the platform
    // allows, and it is what gives that band a JSON error the client can read.
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: uploadSizeLimitError() }, { status: 400 });
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
        return extracted(result.text, result.method, result.pages);
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
    // Only the error's own name, message and stack, never the caught object and
    // never the file: a provider error can carry echoed request content in its
    // fields, and the request content here is somebody's medical document.
    reportError("documents/extract", error, { userId: user.id });
    return NextResponse.json({
      ok: false,
      error: friendlyExtractionError(error),
    }, { status: 422 });
  }
}

type ExtractionMethod = "text" | "pdf" | "pdf_vision" | "image_vision";

/** How many pages the document has, and how many of them Clariti read. */
type PageSpan = { total?: number; read?: number };

function extracted(text: string, extractionMethod: ExtractionMethod, pages: PageSpan = {}) {
  const extractedText = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!hasEnoughDocumentSignal(extractedText)) {
    return NextResponse.json({
      ok: false,
      error: "Clariti could not find enough readable text in this document. Try a clearer scan, or use “Paste the text instead” on the home screen.",
    }, { status: 422 });
  }

  // An itemised bill puts the total on the last page, an EOB puts patient responsibility
  // after the line items, and a discharge summary puts the warning signs at the end — so
  // a document read only as far as MAX_VISION_PAGES is missing the part it was uploaded
  // for, and eighty readable characters off page one are enough to pass the check above.
  // Report the shortfall rather than let a fragment be explained as the whole document.
  const pageCount = pages.total ?? null;
  const pagesRead = pages.read ?? null;

  return NextResponse.json({
    ok: true,
    extractedText,
    extractionMethod,
    charCount: extractedText.length,
    pageCount,
    pagesRead,
    truncated: pageCount !== null && pagesRead !== null && pagesRead < pageCount,
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
    // Thinking shares this budget; see lib/ai/clariti-analysis.ts.
    maxOutputTokens: 8000,
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
    const total = parsed.total;

    // getText reads every page, so this path loses nothing.
    // A different question from the 422 refusal below, and it needs a stricter
    // answer. There, the choice is "is this readable at all"; here it is "is this
    // text layer good enough to skip vision OCR". A scanned bill often carries a
    // thin layer of header furniture — a few dozen words of letterhead — which
    // clears the structural floor while the actual charges live only in the
    // pixels. Falling through to the screenshots costs a model call; not falling
    // through costs the document.
    if (hasEnoughDocumentSignal(parsed.text) && hasUsableTextLayer(parsed.text, total)) {
      return { text: parsed.text, method: "pdf" as const, pages: { total, read: total } };
    }

    const screenshots = await parser.getScreenshot({
      desiredWidth: 1400,
      first: Math.min(total ?? MAX_VISION_PAGES, MAX_VISION_PAGES),
    });
    const pages = screenshots.pages
      .filter((page) => page.data?.length)
      .map((page) => ({
        data: Buffer.from(page.data),
        mediaType: "image/png",
        pageNumber: page.pageNumber,
      }));

    if (!pages.length) return { text: parsed.text, method: "pdf" as const, pages: { total, read: total } };
    return {
      text: await extractWithVisionImages(pages, "rendered PDF pages"),
      method: "pdf_vision" as const,
      pages: { total, read: pages.length },
    };
  } finally {
    await parser.destroy();
  }
}

function friendlyExtractionError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/Provider file upload is not configured|AI Gateway|Anthropic/i.test(message)) {
    return "Clariti could not read this PDF/image because document vision is not configured in production. Try a text-based PDF, a .txt file, or use “Paste the text instead” on the home screen.";
  }
  if (/timeout|aborted|duration|exceeded/i.test(message)) {
    return "Document reading took too long. Try a smaller or clearer PDF/image, or use “Paste the text instead” on the home screen.";
  }
  return "Clariti could not extract readable text from this document. Try a clearer PDF/image, a text-based PDF, or use “Paste the text instead” on the home screen.";
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
    // Thinking shares this budget; see lib/ai/clariti-analysis.ts.
    maxOutputTokens: 12000,
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

/**
 * Whether a PDF's own text layer is worth trusting over rendering the pages and
 * reading them. Density per page is the signal: a real text layer carries
 * hundreds of characters a page, a scan's carries a letterhead.
 */
function hasUsableTextLayer(text: string, totalPages: number | null | undefined) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const pages = Math.max(1, totalPages ?? 1);
  return normalized.length / pages >= 200;
}

function hasEnoughDocumentSignal(text: string) {
  const normalized = text
    .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, " ")
    .replace(/\bpage\s+\d+\s+of\s+\d+\b/gi, " ")
    .replace(/\[no readable text on page\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Structural checks only. This used to end in a regex of English section keywords, so a
  // cleanly extracted Spanish factura ("paciente", "importe", "reclamacion") matched none
  // of them and was refused as a bad scan — in 175 territories, telling people to rephotograph
  // a document that was read perfectly well. Length and word count are what actually separate
  // extracted text from a blank page.
  if (normalized.length < 80) return false;
  if (normalized.split(/\s+/).filter((word) => /[a-z]{3,}/i.test(word)).length < 12) return false;

  return true;
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
