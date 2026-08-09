"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useToast } from "@/components/toast";
import { track } from "@/lib/analytics";

export function ExportDataButton() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function exportData() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/account/export", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast({ tone: "error", message: data?.error || "Couldn’t export your data. Try again." });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `nura-data-export-${stamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      track("data_export");
      toast({ title: "Export ready", message: "Your Nura data download has started." });
    } catch {
      toast({ tone: "error", message: "Couldn’t export your data. Check your connection." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="secondary-cta" onClick={exportData} disabled={busy}>
      <Download /> {busy ? "Preparing…" : "Export all data"}
    </button>
  );
}
