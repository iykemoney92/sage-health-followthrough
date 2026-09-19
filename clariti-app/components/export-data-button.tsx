"use client";

import { Capacitor } from "@capacitor/core";
import { ClipboardCopy, Download, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";

type ExportStatus = { tone: "ok" | "error"; message: string } | null;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ExportDataButton() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ExportStatus>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function exportData() {
    if (busy) return;
    setBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setStatus({
          tone: "error",
          // The 401 body is a machine token, matching every other route in the app; the
          // rest already answer with copy meant to be read, so pass those straight through.
          message: response.status === 401
            ? "Your session has expired. Sign in again, then export your data."
            : payload?.error ?? "Clariti could not build your export. Please try again.",
        });
        return;
      }

      const json = await response.text();
      track("data_export");

      // WKWebView silently drops blob downloads, so the native build hands the file to the
      // clipboard rather than firing an anchor click that looks like it worked and did not.
      if (Capacitor.isNativePlatform()) {
        if (await copyToClipboard(json)) {
          setStatus({ tone: "ok", message: "Copied to your clipboard. Paste it into Notes or an email to keep it." });
        } else {
          // Shown here rather than by navigating to /api/account/export: the iOS shell has
          // no back control, so that page was a dead end force-quitting the app was the
          // only way out of — on the one surface both stores expect a privacy request to
          // work on.
          setPreview(json);
        }
        return;
      }

      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `clariti-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus({ tone: "ok", message: "Your download has started." });
    } catch {
      setStatus({ tone: "error", message: "Clariti could not build your export. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="settings-signout" onClick={() => void exportData()} disabled={busy}>
        <Download /> {busy ? "Preparing your export..." : "Export all data"}
      </button>
      {status ? (
        <p className={status.tone === "error" ? "auth-error" : "settings-footnote"} style={{ marginTop: 8 }} role="status">
          {status.message}
        </p>
      ) : null}
      {preview ? <ExportPreviewDialog json={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

function ExportPreviewDialog({ json, onClose }: { json: string; onClose: () => void }) {
  const [notice, setNotice] = useState("");
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  async function copyAgain() {
    const copied = await copyToClipboard(json);
    setNotice(copied
      ? "Copied to your clipboard. Paste it into Notes or an email to keep it."
      : "Clariti still cannot reach the clipboard. Select the text above to copy it yourself.");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="settings-modal-backdrop" onMouseDown={onClose}>
      <section
        ref={cardRef}
        className="settings-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-data-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="settings-modal-close" type="button" aria-label="Close export" onClick={onClose}><X /></button>
        <p className="clariti-kicker">EXPORT</p>
        <h2 id="export-data-title">Your data export</h2>
        <p>This is every row Clariti holds for your account. Copy it out, or read it here and close when you are done.</p>

        <pre className="source-document-preview">{json}</pre>

        {notice ? <p role="status">{notice}</p> : null}

        <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
          {/* Worth offering again: the first attempt ran after an await, and WebKit only
              honours a clipboard write while the gesture behind it is still live. */}
          <button type="button" className="settings-signout" onClick={() => void copyAgain()}>
            <ClipboardCopy /> Copy to clipboard
          </button>
          <button type="button" className="settings-signout" onClick={onClose}>Done</button>
        </div>
      </section>
    </div>
  );
}
