"use client";

import {
  ArrowUp,
  ClipboardList,
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
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ClaritiAuthModal } from "@/components/clariti-auth-modal";
import { ClaritiShell } from "@/components/clariti-shell";
import type { ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";
import { getClaritiKindMeta } from "@/lib/domain/clariti-document-kinds";
import { inferClaritiKind } from "@/lib/domain/clariti-fallback-analysis";

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

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [kind, setKind] = useState<StarterKind>("medical_bill");
  const [message, setMessage] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [authConfigured, setAuthConfigured] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authIntent, setAuthIntent] = useState<"submit" | "navigate" | null>(null);
  const [authNext, setAuthNext] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionMethod, setExtractionMethod] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const extractionAbortRef = useRef<AbortController | null>(null);

  const hasDocumentText = documentText.trim().length >= 20;
  const hasAskText = Boolean(message.trim());
  const canSubmit = hasAskText && hasDocumentText && !submitting && !extracting;
  const sendDisabledReason = !hasAskText
    ? "Ask a question first"
    : extracting
      ? "Preparing document"
      : !hasDocumentText
        ? "Attach a readable document"
        : "";

  const waitForServerAuth = async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch("/api/auth/status", { cache: "no-store" }).catch(() => null);
      const payload = response?.ok ? await response.json().catch(() => null) : null;
      if (payload?.authenticated) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  };

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/status")
      .then((response) => response.json())
      .then((payload) => {
        if (!alive || !payload?.ok) return;
        setAuthConfigured(Boolean(payload.configured));
        setAuthenticated(Boolean(payload.authenticated));
      })
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const next = searchParams.get("next");
    const confirmed = searchParams.get("confirmed") === "1";

    if (authenticated && confirmed) {
      // Session already established via /auth/confirm — drop the query noise.
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      return;
    }

    if (searchParams.get("auth") === "1" && !authenticated) {
      queueMicrotask(() => {
        setAuthMode(searchParams.get("mode") === "signup" ? "signup" : "signin");
        setAuthNext(next ?? "/");
        setAuthIntent("navigate");
        setAuthOpen(true);
        requestAnimationFrame(() => composerRef.current?.focus());
      });
    }
  }, [authenticated, router, searchParams]);

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

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSelectedFile(file);
    setDocumentText("");
    setExtractionMethod(null);
    setExtractionProgress(8);
    setExtracting(true);
    extractionAbortRef.current?.abort();
    const controller = new AbortController();
    extractionAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60000);

    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/documents/extract", { method: "POST", body: formData, signal: controller.signal });
      const payload = await readJsonResponse(response);
      if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not read this document.");
      const extractedText = String(payload.extractedText ?? "");
      const inferredKind = inferClaritiKind({
        kind,
        question: message.trim(),
        documentText: extractedText,
        fileName: file.name,
      });
      setKind(inferredKind);
      setMessage((current) => isEmptyOrStarterPrompt(current) ? promptForKind(inferredKind) : current);
      setDocumentText(extractedText);
      setExtractionMethod(String(payload.extractionMethod ?? "text"));
      setExtractionProgress(100);
    } catch (caught) {
      setDocumentText("");
      setExtractionProgress(0);
      setError(
        caught instanceof DOMException && caught.name === "AbortError"
          ? "Document reading took too long. Try a clearer PDF/image, a smaller file, or paste the report text."
          : caught instanceof Error ? caught.message : "Could not read this document.",
      );
    } finally {
      window.clearTimeout(timeout);
      if (extractionAbortRef.current === controller) extractionAbortRef.current = null;
      setExtracting(false);
    }
  };

  const clearFile = () => {
    extractionAbortRef.current?.abort();
    extractionAbortRef.current = null;
    setSelectedFile(null);
    setDocumentText("");
    setExtractionMethod(null);
    setExtractionProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      setError("Attach one readable document before analysis.");
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
      if (textForAnalysis.length < 20) {
        throw new Error("Attach one readable document before analysis.");
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
        const uploadPayload = await readJsonResponse(uploadResponse);
        if (!uploadResponse.ok || !uploadPayload.ok) throw new Error(uploadPayload.error ?? "Could not upload document");
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
      setError(caught instanceof Error ? caught.message : "Clariti could not process this document.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthenticated = async () => {
    setAuthenticated(true);
    setAuthOpen(false);

    if (authIntent === "submit") {
      if (!hasDocumentText) {
        setError("Now attach one readable document before analysis.");
        return;
      }
      const serverAuthenticated = await waitForServerAuth();
      if (!serverAuthenticated) {
        setError("Sign-in finished, but Clariti could not confirm the secure session yet. Please press send again.");
        return;
      }
      await runJourney(true);
      return;
    }

    router.push(authNext ?? "/");
  };

  return (
    <ClaritiShell>
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
              onChange={(event) => void handleFileSelected(event.target.files?.[0])}
            />

            {selectedFile && (
              <div className={`entry-attachment ${extracting ? "is-reading" : hasDocumentText ? "is-ready" : "needs-attention"}`}>
                <div className="entry-attachment-icon">
                  {extracting ? <Loader2 className="entry-spinner" /> : <FileText />}
                </div>
                <div className="entry-attachment-body">
                  <div className="entry-attachment-main">
                    <b>{selectedFile.name}</b>
                    <small>{extracting ? `${extractionProgress}%` : hasDocumentText ? "Ready" : "Needs text"}</small>
                  </div>
                  <p>{extracting ? "Preparing this document before send..." : hasDocumentText ? `Readable text extracted from ${extractionLabels[extractionMethod ?? ""] ?? "document"}.` : "Readable document text is required before analysis."}</p>
                  <div className="entry-file-progress" aria-hidden={!extracting && !hasDocumentText}>
                    <span style={{ width: `${hasDocumentText ? 100 : extractionProgress}%` }} />
                  </div>
                </div>
                <button type="button" onClick={clearFile}>Remove</button>
              </div>
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
              </div>
              {sendDisabledReason && <span className="entry-send-hint">{sendDisabledReason}</span>}
              <button type="button" className="clariti-entry-send" aria-label="Send to Clariti" title={sendDisabledReason || "Send to Clariti"} disabled={!canSubmit} onClick={() => void handleSubmit()}>
                {submitting ? <Loader2 className="entry-spinner" /> : <ArrowUp />}
              </button>
            </div>
          </div>

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
        </div>
      </section>

      {authOpen && (
        <ClaritiAuthModal
          modeDefault={authMode}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={handleAuthenticated}
          emailConfirmedNotice={searchParams.get("confirmed") === "1"}
          kicker={authIntent === "navigate" ? "SIGN IN TO CONTINUE" : "SAVE YOUR DOCUMENT"}
          title={authIntent === "navigate" ? "Sign in without losing your ask" : undefined}
          copy={authIntent === "navigate" ? "Create or sign in to Clariti. We will keep you on the Ask Clariti flow and open the page you selected after auth." : undefined}
        />
      )}
    </ClaritiShell>
  );
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as { ok?: boolean; error?: string; extractedText?: string; extractionMethod?: string; document?: { id?: string } };
  } catch {
    return {
      ok: false,
      error: response.ok
        ? "Clariti received an unreadable server response. Please try again."
        : "Clariti could not read this document in production. Try a clearer PDF/image, a text-based PDF, or paste the report text.",
    };
  }
}

function isEmptyOrStarterPrompt(value: string) {
  const normalized = value.trim();
  return !normalized || starters.some((starter) => starter.prompt === normalized);
}

function promptForKind(kind: StarterKind) {
  return getClaritiKindMeta(kind).starterPrompt;
}
