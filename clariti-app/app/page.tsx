"use client";

import {
  ArrowUp,
  FileText,
  Loader2,
  Paperclip,
  ReceiptText,
  ScanText,
  ShieldCheck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { ClaritiAuthModal } from "@/components/clariti-auth-modal";
import { ClaritiShell } from "@/components/clariti-shell";

type StarterKind = "medical_bill" | "insurance_eob" | "radiology_report";

const starters = [
  {
    kind: "medical_bill",
    title: "Explain a medical bill",
    meta: "Charges, flags and what to ask next",
    prompt: "Please explain this medical bill in plain English, break down the charges, flag anything unusual, and tell me what I should ask next.",
    uploadHint: "Upload your medical bill, invoice or statement to continue.",
    Icon: ReceiptText,
  },
  {
    kind: "radiology_report",
    title: "Understand a radiology report",
    meta: "Findings, anatomy and clinician questions",
    prompt: "Please explain this radiology report in plain English, clarify the findings and anatomy mentioned, and suggest useful questions I can ask my clinician.",
    uploadHint: "Upload your radiology report, scan report or clear image to continue.",
    Icon: ScanText,
  },
  {
    kind: "insurance_eob",
    title: "Decode an insurance EOB",
    meta: "What was billed, covered and left to you",
    prompt: "Please decode this insurance EOB, explain what was billed and covered, what I may owe, and flag anything I should query with the insurer or provider.",
    uploadHint: "Upload your EOB or explanation-of-benefits document to continue.",
    Icon: ShieldCheck,
  },
] as const;

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
  const [authIntent, setAuthIntent] = useState<"submit" | "navigate" | null>(null);
  const [authNext, setAuthNext] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasDocumentText = documentText.trim().length >= 20;
  const hasAskText = Boolean(message.trim());
  const canSubmit = hasAskText && hasDocumentText && !submitting;

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

    if (searchParams.get("auth") === "1" && !authenticated) {
      queueMicrotask(() => {
        setAuthNext(next ?? "/");
        setAuthIntent("navigate");
        setAuthOpen(true);
        requestAnimationFrame(() => composerRef.current?.focus());
      });
    }
  }, [authenticated, searchParams]);

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

    if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
      setDocumentText(await file.text());
      return;
    }

    setDocumentText("");
    setError("For this build, attach a .txt file with the report, bill or EOB text.");
  };

  const clearFile = () => {
    setSelectedFile(null);
    setDocumentText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    setError(null);

    if (!message.trim()) {
      setError("Ask Clariti a question before sending.");
      return;
    }

    if (!authenticated) {
      setAuthIntent("submit");
      setAuthNext(null);
      setAuthOpen(true);
      return;
    }

    if (!hasDocumentText) {
      setError("Attach one text document before analysis.");
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
        throw new Error("Attach one text document before analysis.");
      }

      if (selectedFile && authConfigured && authenticatedForRun) {
        const formData = new FormData();
        formData.set("file", selectedFile);
        formData.set("kind", kind);
        formData.set("extractedText", textForAnalysis);

        const uploadResponse = await fetch("/api/documents/upload", { method: "POST", body: formData });
        const uploadPayload = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadPayload.ok) throw new Error(uploadPayload.error ?? "Could not upload document");
        documentId = uploadPayload.document?.id;
      }

      const analysisResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          question: message.trim(),
          fileName: selectedFile?.name,
          documentText: textForAnalysis,
          documentId,
        }),
      });
      const analysisPayload = await analysisResponse.json();
      if (!analysisResponse.ok || !analysisPayload.ok) throw new Error(analysisPayload.error ?? "Could not analyze document");

      window.localStorage.setItem("clariti-active-request", JSON.stringify({
        kind,
        question: message.trim(),
        documentText: textForAnalysis,
        fileName: selectedFile?.name,
        analysis: analysisPayload.analysis,
        persisted: analysisPayload.persisted,
      }));
      const savedSessionId = analysisPayload.persisted?.session?.id;
      router.push(savedSessionId ? `/workspace?sessionId=${savedSessionId}` : "/workspace");
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
        setError("Now attach one text document before analysis.");
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
            Ask a question and attach one health document. Clariti creates a grounded analysis,
            then opens a workspace for actions, calls and follow-ups.
          </p>

          <div className="clariti-entry-composer">
            <input
              ref={fileInputRef}
              type="file"
              className="entry-file-input"
              accept=".txt,text/plain"
              onChange={(event) => void handleFileSelected(event.target.files?.[0])}
            />

            {selectedFile && (
              <div className="entry-attachment">
                <FileText />
                <span>
                  <b>{selectedFile.name}</b>
                  <small>{hasDocumentText ? "Text extracted or pasted and ready" : "Paste the document text below before analysis."}</small>
                </span>
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
              <button type="button" className="clariti-entry-send" aria-label="Send to Clariti" disabled={!canSubmit} onClick={() => void handleSubmit()}>
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
            <span>One document per query keeps Clariti grounded. It explains and organises information; it does not diagnose.</span>
          </div>
        </div>
      </section>

      {authOpen && (
        <ClaritiAuthModal
          modeDefault="signin"
          onClose={() => setAuthOpen(false)}
          onAuthenticated={handleAuthenticated}
          kicker={authIntent === "navigate" ? "SIGN IN TO CONTINUE" : "SAVE YOUR DOCUMENT"}
          title={authIntent === "navigate" ? "Sign in without losing your ask" : undefined}
          copy={authIntent === "navigate" ? "Create or sign in to Clariti. We will keep you on the Ask Clariti flow and open the page you selected after auth." : undefined}
        />
      )}
    </ClaritiShell>
  );
}
