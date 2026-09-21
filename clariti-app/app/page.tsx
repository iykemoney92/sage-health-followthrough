"use client";

import {
  ArrowUp,
  Camera,
  ClipboardList,
  ClipboardPaste,
  FileHeart,
  FileText,
  FlaskConical,
  Hospital,
  Loader2,
  Paperclip,
  Pill,
  ReceiptText,
  ScanText,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, Suspense, useEffect, useRef, useState } from "react";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { AppDownloadLinks } from "@/components/app-download-links";
import { ClaritiAuthModal } from "@/components/clariti-auth-modal";
import { ClaritiShell } from "@/components/clariti-shell";
import { prepareDocumentForUpload, readDocumentApiResponse } from "@/components/clariti/document-upload";
import type { ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";
import { track } from "@/lib/analytics";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";
import { inferClaritiKind } from "@/lib/domain/clariti-fallback-analysis";
import { formatHumanError } from "@/lib/domain/human-errors";
// Styles the one link below the composer that points at /example. Every other
// stylesheet is imported by app/layout.tsx; this one belongs to that page and is
// pulled in here so the link is styled on the landing screen too.
import "./example.css";

type StarterKind = ClaritiAnalysisKind;

const starterIcons: Partial<Record<ClaritiAnalysisKind, typeof ReceiptText>> = {
  medical_bill: ReceiptText,
  insurance_eob: ShieldCheck,
  radiology_report: ScanText,
  lab_results: FlaskConical,
  discharge_summary: Hospital,
  medication_context: Pill,
  pathology_report: FileHeart,
  visit_notes: ClipboardList,
  unknown: FileText,
};

const starterOrder: ClaritiAnalysisKind[] = [
  "medical_bill",
  "insurance_eob",
  "radiology_report",
  "lab_results",
  "discharge_summary",
  "medication_context",
  "unknown",
];

const starters = starterOrder.map((kind) => {
  const meta = getClaritiKindMeta(kind);
  return {
    kind,
    title: meta.starterTitle,
    meta: meta.starterMeta,
    prompt: meta.starterPrompt,
    uploadHint: meta.uploadHint,
    Icon: starterIcons[kind] ?? FileText,
  };
});

const extractionLabels: Record<string, string> = {
  text: "text file",
  pdf: "PDF text",
  pdf_vision: "scanned PDF",
  image_vision: "image",
};

/** The floor /api/analyze itself enforces: anything shorter is not a document. */
const MIN_DOCUMENT_CHARS = 20;

const unreadableDocumentMessage =
  "Clariti could not read this document. Try a clearer photo or a text-based PDF, or paste the report text instead.";

export default function Home() {
  return <HomeContent />;
}

function HomeContent() {
  const router = useRouter();
  const [query, setQuery] = useState<LandingQuery>(noLandingQuery);
  const [kind, setKind] = useState<StarterKind>("medical_bill");
  const [message, setMessage] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authIntent, setAuthIntent] = useState<"submit" | "navigate" | null>(null);
  const [authNext, setAuthNext] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionMethod, setExtractionMethod] = useState<string | null>(null);
  const [truncation, setTruncation] = useState<{ read: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentTextRef = useRef<HTMLTextAreaElement>(null);
  const extractionAbortRef = useRef<AbortController | null>(null);

  const pastedLength = pastedText.trim().length;
  const hasExtractedText = extractedText.trim().length >= MIN_DOCUMENT_CHARS;
  // Typed text wins over a file's extraction once it is long enough to analyse. Pasting
  // is the documented way out of a photo that reads as nothing, so it has to override
  // that photo rather than sit beside it.
  const documentText = pastedLength >= MIN_DOCUMENT_CHARS ? pastedText : extractedText;
  const hasDocumentText = documentText.trim().length >= MIN_DOCUMENT_CHARS;
  const hasAskText = Boolean(message.trim());
  // A file picked while signed out is held unread on purpose, so send stays live for it:
  // pressing it reopens the sign-in gate rather than asking for a document that is
  // already attached.
  const pendingSignIn = Boolean(selectedFile) && !authenticated;
  const canSubmit = hasAskText && (hasDocumentText || pendingSignIn) && !submitting && !extracting;
  const sendDisabledReason = !hasAskText
    ? "Ask a question first"
    : extracting
      ? "Preparing document"
      : !hasDocumentText && !pendingSignIn
        ? "Attach a document or paste its text"
        : "";

  /**
   * Polls until the session cookie the routes read is actually set, and reports the
   * consent state with it: a fresh sign-up has none, and /api/documents/extract refuses
   * a request without it.
   */
  const waitForServerAuth = async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch("/api/auth/status", { cache: "no-store" }).catch(() => null);
      const payload = response?.ok ? await response.json().catch(() => null) : null;
      if (payload?.authenticated) return { authenticated: true, aiConsent: Boolean(payload.aiConsent) };
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { authenticated: false, aiConsent: false };
  };

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((payload) => {
        if (!alive || !payload?.ok) return;
        setAuthConfigured(Boolean(payload.configured));
        setAuthenticated(Boolean(payload.authenticated));
        setAiConsent(Boolean(payload.aiConsent));
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (authenticated && query.confirmed) {
      // Session already established via /auth/confirm — drop the query noise.
      const next = query.next;
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      return;
    }

    if (query.auth && !authenticated) {
      queueMicrotask(() => {
        setAuthMode(query.mode === "signup" ? "signup" : "signin");
        setAuthNext(query.next ?? "/");
        setAuthIntent("navigate");
        setAuthOpen(true);
        requestAnimationFrame(() => composerRef.current?.focus());
      });
    }
  }, [authenticated, query, router]);

  useEffect(() => {
    if (!extracting) return;

    const interval = window.setInterval(() => {
      setExtractionProgress((progress) => Math.min(progress + Math.max(1, Math.round((92 - progress) * 0.12)), 92));
    }, 700);

    return () => window.clearInterval(interval);
  }, [extracting]);

  const chooseStarter = (starterKind: StarterKind, prompt: string) => {
    setKind(starterKind);
    setMessage(prompt);
    setError(null);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const chooseFile = () => {
    fileInputRef.current?.click();
  };

  const chooseCamera = () => {
    cameraInputRef.current?.click();
  };

  const openPaste = () => {
    setPasteOpen(true);
    requestAnimationFrame(() => documentTextRef.current?.focus());
  };

  const handlePickedFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    await handleFileSelected(input.files?.[0]);
    // Choosing the same file again fires no change event, so a document that failed to
    // read could not be retried without picking a different one first.
    input.value = "";
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;

    // Picking a file posts it straight to /api/documents/extract, which is the
    // first moment a document would leave the device — so a signed-in user who
    // has not agreed to AI processing goes to the gate instead of the extractor.
    // The route refuses them anyway; this just makes the refusal a question
    // rather than an error.
    if (authenticated && !aiConsent) {
      router.push("/ai-consent?next=%2F");
      return;
    }

    // The funnel's missing denominator: nothing fires between the landing view and a
    // finished analysis, so a document that never reads is invisible. Mime and a size
    // bucket only — the document's own category is health data and stays out of GA.
    track("document_selected", { mime: file.type || "unknown", size_bucket: fileSizeBucket(file.size) });

    // The extractor refuses an anonymous request too, and its 401 body — the single
    // word "unauthorized" — was being rendered as Clariti's answer. Hold the file,
    // ask for the sign-in this flow always needed, and read it in handleAuthenticated
    // so the pick survives.
    if (!authenticated) {
      setError(null);
      setSelectedFile(file);
      setExtractedText("");
      setExtractionMethod(null);
    setTruncation(null);
      setExtractionProgress(0);
      setAuthMode("signin");
      setAuthIntent("submit");
      setAuthNext(null);
      setAuthOpen(true);
      return;
    }

    await extractDocument(file);
  };

  const extractDocument = async (file: File) => {
    setError(null);
    setSelectedFile(file);
    setExtractedText("");
    setExtractionMethod(null);
    setTruncation(null);
    setExtractionProgress(8);
    setExtracting(true);
    extractionAbortRef.current?.abort();
    const controller = new AbortController();
    extractionAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60000);

    // Which half failed is the point of the event below: "prepare" is this browser
    // refusing the file, "extract" is the server finding no readable text in it.
    let stage: "prepare" | "extract" = "prepare";

    try {
      // runJourney uploads this same file again, so the prepared copy replaces the picked
      // one in state: sending the original bytes to /upload and the shrunk bytes to
      // /extract would file a document that does not match the text Clariti analysed.
      const prepared = await prepareDocumentForUpload(file);
      if (!prepared.ok) throw new Error(prepared.error);
      setSelectedFile(prepared.file);
      stage = "extract";

      const formData = new FormData();
      formData.set("file", prepared.file);
      const response = await fetch("/api/documents/extract", { method: "POST", body: formData, signal: controller.signal });
      const payload = await readDocumentApiResponse(response);
      if (!response.ok || !payload.ok) {
        throw new Error(formatHumanError(response.status, payload.error, unreadableDocumentMessage));
      }
      const text = String(payload.extractedText ?? "");
      const inferredKind = inferClaritiKind({
        kind,
        question: message.trim(),
        documentText: text,
        fileName: file.name,
      });
      setKind(inferredKind);
      setMessage((current) => isEmptyOrStarterPrompt(current) ? promptForKind(inferredKind) : current);
      setExtractedText(text);
      setExtractionMethod(String(payload.extractionMethod ?? "text"));
      // Said out loud, because the reader cannot tell. Vision extraction stops at
      // the first few pages, and the number that matters — the total, the patient
      // responsibility, the warning signs — is usually on the last one.
      setTruncation(
        payload.truncated && typeof payload.pagesRead === "number" && typeof payload.pageCount === "number"
          ? { read: payload.pagesRead, total: payload.pageCount }
          : null,
      );
      setExtractionProgress(100);
    } catch (caught) {
      // Removing the attachment, or picking another file, aborts this controller on
      // purpose — only a run still registered here failed on its own, so the other two
      // stay silent instead of reporting a timeout the reader did not cause.
      if (extractionAbortRef.current !== controller) return;
      const timedOut = caught instanceof DOMException && caught.name === "AbortError";
      track("extract_failed", { mime: file.type || "unknown", reason: timedOut ? "timeout" : stage });
      setExtractedText("");
      setExtractionProgress(0);
      setError(formatHumanError(null, caught, unreadableDocumentMessage));
    } finally {
      window.clearTimeout(timeout);
      if (extractionAbortRef.current === controller) {
        extractionAbortRef.current = null;
        setExtracting(false);
      }
    }
  };

  const clearFile = () => {
    extractionAbortRef.current?.abort();
    extractionAbortRef.current = null;
    setExtracting(false);
    setSelectedFile(null);
    setExtractedText("");
    setExtractionMethod(null);
    setTruncation(null);
    setExtractionProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    setError(null);

    if (!message.trim()) {
      setError("Ask Clariti a question before sending.");
      return;
    }

    if (!authenticated) {
      setAuthMode("signin");
      setAuthIntent("submit");
      setAuthNext(null);
      setAuthOpen(true);
      return;
    }

    if (!hasDocumentText) {
      setError("Attach a document or paste its text before analysis.");
      return;
    }

    await runJourney();
  };

  const runJourney = async (authenticatedForRun = authenticated) => {
    setSubmitting(true);
    setError(null);

    try {
      const textForAnalysis = documentText.trim();
      let documentId: string | undefined;
      if (textForAnalysis.length < MIN_DOCUMENT_CHARS) {
        throw new Error("Attach a document or paste its text before analysis.");
      }
      const resolvedKind = inferClaritiKind({
        kind,
        question: message.trim(),
        documentText: textForAnalysis,
        fileName: selectedFile?.name,
      });

      if (selectedFile && authConfigured && authenticatedForRun) {
        const formData = new FormData();
        formData.set("file", selectedFile);
        formData.set("kind", resolvedKind);
        formData.set("extractedText", textForAnalysis);

        const uploadResponse = await fetch("/api/documents/upload", { method: "POST", body: formData });
        const uploadPayload = await readDocumentApiResponse(uploadResponse);
        if (!uploadResponse.ok || !uploadPayload.ok) {
          throw new Error(formatHumanError(uploadResponse.status, uploadPayload.error, "Clariti could not save this document to your account."));
        }
        documentId = typeof uploadPayload.document === "object" && uploadPayload.document && "id" in uploadPayload.document
          ? String(uploadPayload.document.id)
          : undefined;
      }

      window.localStorage.setItem("clariti-active-request", JSON.stringify({
        kind: resolvedKind,
        question: message.trim(),
        documentText: textForAnalysis,
        fileName: selectedFile?.name,
        documentId,
        requestId: crypto.randomUUID(),
        createdAt: Date.now(),
        status: "pending",
      }));
      try {
        window.sessionStorage.removeItem("clariti-boot-lock");
        window.sessionStorage.removeItem("clariti-active-session-id");
      } catch {
        // ignore
      }
      router.push("/workspace?new=1");
    } catch (caught) {
      setError(formatHumanError(null, caught, "Clariti could not process this document."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthenticated = async () => {
    setAuthenticated(true);
    setAuthOpen(false);

    if (authIntent === "submit") {
      const session = await waitForServerAuth();
      if (!session.authenticated) {
        setError("Sign-in finished, but Clariti could not confirm the secure session yet. Please press send again.");
        return;
      }
      setAiConsent(session.aiConsent);

      // A file picked while signed out was held rather than sent. Read it now, on the
      // session that just landed — unless consent is still outstanding, which is the
      // one thing that has to come before a document leaves the device.
      if (selectedFile && !hasExtractedText) {
        if (!session.aiConsent) {
          router.push("/ai-consent?next=%2F");
          return;
        }
        await extractDocument(selectedFile);
        return;
      }

      if (!hasDocumentText) {
        setError("Now attach a document, or paste its text, before analysis.");
        return;
      }

      // Only the send button promises an analysis. A pick that opened this gate leaves a
      // ready composer instead, because /api/analyze refuses an empty question anyway.
      if (!hasAskText) return;

      await runJourney(true);
      return;
    }

    router.push(authNext ?? "/");
  };

  return (
    <ClaritiShell>
      <Suspense fallback={null}>
        <LandingQueryReader onChange={setQuery} />
      </Suspense>
      <AnalyticsBeacon event="landing_view" />
      <section className="clariti-entry-page" data-ui-version="clariti-preview-latest">
        <div className="clariti-entry-inner">
          <div className="clariti-entry-mark">C</div>
          <h1>What can I help you understand?</h1>
          <p className="clariti-entry-sub">
            Attach any confusing health paperwork — bills, EOBs, scans, labs, discharge notes, med lists, and more.
            Clariti explains it in plain language, then helps you decide what to ask next.
          </p>

          <div className="clariti-entry-composer">
            <input
              ref={fileInputRef}
              type="file"
              className="entry-file-input"
              accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,text/plain,application/pdf,image/*"
              onChange={(event) => void handlePickedFile(event)}
            />

            {/* Clariti's whole premise is photographing the paperwork in your hand, and
                nothing on this screen said so. `capture` opens the camera instead of the
                chooser; it stays a second input because putting the attribute on the one
                above would take PDFs off the table. */}
            <input
              ref={cameraInputRef}
              type="file"
              className="entry-file-input"
              accept="image/*"
              capture="environment"
              onChange={(event) => void handlePickedFile(event)}
            />

            {selectedFile && (
              <div className={`entry-attachment ${extracting ? "is-reading" : hasExtractedText ? "is-ready" : "needs-attention"}`}>
                <div className="entry-attachment-icon">
                  {extracting ? <Loader2 className="entry-spinner" /> : <FileText />}
                </div>
                <div className="entry-attachment-body">
                  <div className="entry-attachment-main">
                    <b>{selectedFile.name}</b>
                    <small>{extracting ? `${extractionProgress}%` : hasExtractedText ? "Ready" : pendingSignIn ? "Held" : "Needs text"}</small>
                  </div>
                  <p>{extracting
                    ? "Preparing this document before send..."
                    : hasExtractedText
                      ? truncation
                        ? `Clariti read the first ${truncation.read} of ${truncation.total} pages. Anything after that — often the total or the follow-up instructions — is not included.`
                        : `Readable text extracted from ${extractionLabels[extractionMethod ?? ""] ?? "document"}.`
                      : pendingSignIn
                        ? "Still on your device. Sign in and Clariti reads it — nothing was sent."
                        : "Clariti found no readable text in this file. Paste what it says instead."}</p>
                  <div className="entry-file-progress" aria-hidden={!extracting && !hasExtractedText}>
                    <span style={{ width: `${hasExtractedText ? 100 : extractionProgress}%` }} />
                  </div>
                </div>
                <button type="button" onClick={clearFile}>Remove</button>
              </div>
            )}

            {/* Eight error messages across the product tell people to paste the report
                text, and until now there was nowhere to paste it. This is the exit from
                every unreadable photo, refused PDF and failed extraction at once. */}
            {pasteOpen ? (
              <div className="entry-document-panel">
                <div className="entry-document-panel-header">
                  <span>The document text</span>
                  <small>
                    {pastedLength === 0
                      ? `At least ${MIN_DOCUMENT_CHARS} characters`
                      : pastedLength >= MIN_DOCUMENT_CHARS
                        ? "Clariti will read this"
                        : `${MIN_DOCUMENT_CHARS - pastedLength} more characters`}
                  </small>
                </div>
                <textarea
                  ref={documentTextRef}
                  className="entry-document-text"
                  aria-label="The document text"
                  placeholder="Type or paste what the document says — the lines, the codes, the amounts."
                  value={pastedText}
                  onChange={(event) => setPastedText(event.target.value)}
                />
              </div>
            ) : (
              <button type="button" className="entry-upload-nudge" onClick={openPaste}>
                <ClipboardPaste />
                <span>
                  <b>Paste the text instead</b>
                  <small>No file to hand, or a photo Clariti cannot read? Give it the words and it works from those.</small>
                </span>
              </button>
            )}

            <textarea
              ref={composerRef}
              aria-label="Ask Clariti"
              placeholder="Ask Clariti anything about one health document..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />

            {error && <p className="entry-error">{error}</p>}

            <div className="entry-composer-footer">
              <div className="entry-tools">
                <button type="button" onClick={chooseFile}><Paperclip /> {selectedFile ? "Replace document" : "Attach document"}</button>
                <button type="button" onClick={chooseCamera}><Camera /> Take a photo</button>
              </div>
              {sendDisabledReason && <span className="entry-send-hint">{sendDisabledReason}</span>}
              <button type="button" className="clariti-entry-send" aria-label="Send to Clariti" title={sendDisabledReason || "Send to Clariti"} disabled={!canSubmit} onClick={() => void handleSubmit()}>
                {submitting ? <Loader2 className="entry-spinner" /> : <ArrowUp />}
              </button>
            </div>
          </div>

          {/* Every starter below asks for an upload, and so does the composer above:
              until now the only way to find out what Clariti does with a health
              document was to hand it one carrying your name and your diagnosis.
              This is the way through that screen for someone who is hesitating, so
              it sits with the attach controls rather than in a footer — and stays a
              line of text, because the person who already knows what they want is
              reaching for send. */}
          <Link className="entry-example-link" href="/example">
            <FileText />
            <span>Rather see it work first? <b>Read an example analysis</b> — an invented report.</span>
          </Link>

          <div className="clariti-entry-starters" aria-label="Quick starts">
            {starters.map(({ kind: starterKind, title, meta, prompt, Icon }) => (
              <button type="button" key={title} onClick={() => chooseStarter(starterKind, prompt)}>
                <span className="entry-starter-icon"><Icon /></span>
                <span className="entry-starter-copy">
                  <b>{title}</b>
                  <small>{meta}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="clariti-entry-trust">
            <ShieldCheck />
            <span>One document at a time keeps Clariti honest. It explains paperwork in plain language — it does not diagnose.</span>
          </div>

          <AppDownloadLinks />
        </div>
      </section>

      {authOpen && (
        <ClaritiAuthModal
          modeDefault={authMode}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={handleAuthenticated}
          emailConfirmedNotice={query.confirmed}
          kicker={authIntent === "navigate" ? "SIGN IN TO CONTINUE" : "SAVE YOUR DOCUMENT"}
          title={authIntent === "navigate" ? "Sign in without losing your ask" : undefined}
          copy={authIntent === "navigate" ? "Create or sign in to Clariti. We will keep you on the Ask Clariti flow and open the page you selected after auth." : undefined}
        />
      )}
    </ClaritiShell>
  );
}

type LandingQuery = {
  next: string | null;
  confirmed: boolean;
  auth: boolean;
  mode: string | null;
};

const noLandingQuery: LandingQuery = { next: null, confirmed: false, auth: false, mode: null };

/**
 * `useSearchParams` opts its whole Suspense boundary out of server rendering, and that
 * boundary used to be the page: https://useclariti.app answered with a single
 * BAILOUT_TO_CLIENT_SIDE_RENDERING template and 139 bytes of body, which is a white
 * screen on cellular and on every cold start of the App Store build. Reading the query
 * down here keeps the bailout inside one empty child so the hero, the composer and the
 * starters ship as HTML.
 */
function LandingQueryReader({ onChange }: { onChange: (query: LandingQuery) => void }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const confirmed = searchParams.get("confirmed") === "1";
  const auth = searchParams.get("auth") === "1";
  const mode = searchParams.get("mode");

  useEffect(() => {
    onChange({ next, confirmed, auth, mode });
  }, [auth, confirmed, mode, next, onChange]);

  return null;
}

function isEmptyOrStarterPrompt(value: string) {
  const normalized = value.trim();
  return !normalized || starters.some((starter) => starter.prompt === normalized);
}

function promptForKind(kind: StarterKind) {
  return getClaritiKindMeta(kind).starterPrompt;
}

/**
 * A bucket, never the byte count: an exact size fingerprints the person's own document,
 * and the only question worth asking is whether picks pile up against the 4MB upload cap.
 */
function fileSizeBucket(bytes: number) {
  if (bytes < 256 * 1024) return "lt_256kb";
  if (bytes < 1024 * 1024) return "lt_1mb";
  if (bytes < 2 * 1024 * 1024) return "lt_2mb";
  if (bytes < 4 * 1024 * 1024) return "lt_4mb";
  return "gte_4mb";
}
