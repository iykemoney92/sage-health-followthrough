"use client";

import { Capacitor } from "@capacitor/core";
import { Download } from "lucide-react";
import { useState } from "react";
import { track } from "@/lib/analytics";

type ExportStatus = { tone: "ok" | "error"; message: string } | null;

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
          window.location.assign("/api/account/export");
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
    </div>
  );
}
