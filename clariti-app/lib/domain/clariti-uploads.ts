/**
 * How large a document Clariti accepts, and the words it uses to say no.
 *
 * The number is load-bearing in three places at once — the client shrinks and refuses
 * against it, and both document routes reject against it — and the three drifting apart
 * is exactly how the last cliff appeared: the routes advertised 12MB while Vercel was
 * refusing anything over 4.5MB at the edge, before the route ran at all. Keeping the cap
 * and its copy here means a change to one moves all of them.
 */

/** Vercel's edge body cap is 4.5MB; the rest is headroom for the multipart envelope and the extracted-text field. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** What the two document routes return when a body does squeeze past the edge. */
export function uploadSizeLimitError() {
  return `Use a file smaller than ${formatFileSize(MAX_UPLOAD_BYTES)}.`;
}

/** For a 413 written by the edge, where the file's own size is not in the response. */
export function uploadTooLargeMessage() {
  return `That file is too large to send. Clariti can read documents up to ${formatFileSize(MAX_UPLOAD_BYTES)}. Try a smaller photo or scan, split the PDF, or paste the report text.`;
}

/**
 * The message to show instead of uploading, or null when the file can go. Call it on
 * the prepared file: an image is only over the limit here if downscaling could not
 * bring it under, which is a real refusal rather than a missed opportunity.
 */
export function oversizeUploadMessage(file: { name: string; type: string; size: number }) {
  if (file.size <= MAX_UPLOAD_BYTES) return null;

  const limit = formatFileSize(MAX_UPLOAD_BYTES);
  if (isPdfFile(file)) {
    return `That PDF is ${formatFileSize(file.size)}, and Clariti can read documents up to ${limit}. Try exporting fewer pages, saving a smaller copy, or pasting the report text.`;
  }
  return `That file is ${formatFileSize(file.size)}, and Clariti can read documents up to ${limit}. Try a smaller photo or scan, or paste the report text.`;
}

export function isImageFile(file: { name: string; type: string }) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|heic|heif|gif|bmp|tiff?)$/i.test(file.name);
}

export function isPdfFile(file: { name: string; type: string }) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}
