import type Anthropic from "@anthropic-ai/sdk";
import type { MessageAttachment } from "@/lib/domain/message-intake";

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const DOCX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

// Uncapped, this used to hang until the WhatsApp webhook's 60s maxDuration killed the whole
// function before any catch block could log the failure. Sized to leave room for the WhatsApp
// media download (lib/integrations/whatsapp.ts) plus resolveDecision's 45s ceiling and the reply.
const ELEVENLABS_TIMEOUT_MS = 22_000;

function isDocx(attachment: MessageAttachment) {
  return DOCX_TYPES.has(attachment.type) || /\.docx?$/i.test(attachment.name);
}

// Client-declared MIME types are just a claim - a client could label anything "image/jpeg".
// Checking the actual leading bytes catches mismatched/spoofed content before it reaches
// Claude's vision API or the docx parser, rather than trusting the label at face value.
const MAGIC_BYTES: Record<string, (bytes: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/gif": (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  "image/webp": (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  "application/pdf": (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  // docx/doc are zip containers - check the local-file-header signature (PK\x03\x04)
  docx: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
};

function matchesDeclaredType(base64: string, checkKey: string): boolean {
  const check = MAGIC_BYTES[checkKey];
  if (!check) return true;
  try {
    const head = Buffer.from(base64.slice(0, 32), "base64");
    return check(head);
  } catch {
    return false;
  }
}

async function extractDocxText(base64: string): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer = Buffer.from(base64, "base64");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

async function transcribeAudioBase64(base64: string, mediaType: string, filename: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("[attachments] ELEVENLABS_API_KEY is not configured - skipping audio transcription");
    return "";
  }

  const buffer = Buffer.from(base64, "base64");
  const blob = new Blob([buffer], { type: mediaType || "audio/webm" });
  const form = new FormData();
  form.append("file", blob, filename || "audio");
  form.append("model_id", "scribe_v1");

  console.log("[attachments] transcribing audio:", { filename, mediaType, bytes: buffer.byteLength });

  let response: Response;
  const start = Date.now();
  try {
    response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error(
      timedOut
        ? `[attachments] ElevenLabs request timed out after ${ELEVENLABS_TIMEOUT_MS}ms`
        : "[attachments] ElevenLabs request failed:",
      timedOut ? "" : error,
    );
    return "";
  }
  const elapsedMs = Date.now() - start;
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[attachments] ElevenLabs error:", response.status, detail, `(${elapsedMs}ms)`);
    return "";
  }
  const data = await response.json();
  const text = ((data.text as string | undefined) ?? "").trim();
  if (!text) {
    console.error("[attachments] ElevenLabs returned 200 OK but an empty/unusable transcript:", {
      elapsedMs,
      languageCode: data.language_code,
      languageProbability: data.language_probability,
      audioDurationSecs: data.audio_duration_secs,
      responseKeys: Object.keys(data ?? {}),
    });
  } else {
    console.log("[attachments] transcription succeeded:", { elapsedMs, chars: text.length });
  }
  return text;
}

type ProcessedAttachments = {
  attachments: MessageAttachment[];
  blocks: Anthropic.ContentBlockParam[];
};

/**
 * Turns raw uploaded attachments into (a) text-only records safe to persist/log, and
 * (b) native Claude content blocks for images/PDFs so Nura actually sees them, not just
 * the filename. Anything that fails to process degrades to a filename-only record rather
 * than blocking the message.
 */
export async function processAttachments(attachments: MessageAttachment[]): Promise<ProcessedAttachments> {
  const blocks: Anthropic.ContentBlockParam[] = [];
  const processed: MessageAttachment[] = [];

  for (const attachment of attachments) {
    const base64 = attachment.base64;

    if (!base64) {
      processed.push(attachment);
      continue;
    }

    if (attachment.kind === "image" && SUPPORTED_IMAGE_TYPES.has(attachment.type)) {
      if (!matchesDeclaredType(base64, attachment.type)) {
        processed.push({ ...attachment, base64: undefined, text: "(this file's content didn't match the image type it was uploaded as, so it wasn't processed)" });
        continue;
      }
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: attachment.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
      });
      processed.push({ ...attachment, base64: undefined, text: attachment.text || "(image shared - visible to Nura)" });
      continue;
    }

    if (attachment.type === "application/pdf") {
      if (!matchesDeclaredType(base64, "application/pdf")) {
        processed.push({ ...attachment, base64: undefined, text: "(this file's content didn't match a PDF, so it wasn't processed)" });
        continue;
      }
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      });
      processed.push({ ...attachment, base64: undefined, text: attachment.text || "(PDF shared - visible to Nura)" });
      continue;
    }

    if (isDocx(attachment)) {
      if (!matchesDeclaredType(base64, "docx")) {
        processed.push({ ...attachment, base64: undefined, text: "(this file's content didn't match a Word document, so it wasn't processed)" });
        continue;
      }
      try {
        const text = await extractDocxText(base64);
        processed.push({ ...attachment, base64: undefined, text: text.slice(0, 4000) });
      } catch {
        processed.push({ ...attachment, base64: undefined, text: "(couldn't extract text from this document)" });
      }
      continue;
    }

    if (attachment.kind === "audio") {
      try {
        const transcript = await transcribeAudioBase64(base64, attachment.type, attachment.name);
        processed.push({ ...attachment, base64: undefined, text: transcript.slice(0, 4000) });
      } catch (error) {
        console.error("[attachments] audio transcription threw:", error);
        processed.push({ ...attachment, base64: undefined, text: "" });
      }
      continue;
    }

    if (attachment.type.startsWith("video/")) {
      // Claude's Messages API has no video content block - be honest about the gap rather
      // than silently discarding the attachment with no explanation.
      processed.push({ ...attachment, base64: undefined, text: "(video shared - Nura can't watch video yet, so ask the user to describe what's in it)" });
      continue;
    }

    processed.push({ ...attachment, base64: undefined });
  }

  return { attachments: processed, blocks };
}
