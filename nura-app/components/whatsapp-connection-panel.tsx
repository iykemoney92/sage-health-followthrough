"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, MessageCircle, RefreshCw, Unplug } from "lucide-react";
import { WhatsAppOpenButton } from "@/components/whatsapp-open-button";
import { useToast } from "@/components/toast";

export function WhatsAppConnectionPanel({
  initialLinked,
  hasPlus,
  preferredChannel,
}: {
  initialLinked: boolean;
  hasPlus: boolean;
  preferredChannel: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [linked, setLinked] = useState(initialLinked);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const usesWhatsapp = preferredChannel === "whatsapp" || preferredChannel === "both";

  async function refreshStatus() {
    setBusy(true);
    try {
      const response = await fetch("/api/whatsapp/link?status=1", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        toast({ tone: "error", message: "Couldn’t refresh WhatsApp status. Try again." });
        return;
      }
      setLinked(Boolean(data.linked));
      setCode(data.linked ? null : (data.code as string | null) ?? null);
      toast({
        title: data.linked ? "WhatsApp connected" : "Not connected yet",
        message: data.linked
          ? "Nura can message you on WhatsApp for check-ins."
          : "Open WhatsApp with the connect button, then send the link message.",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/whatsapp/link", { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        toast({ tone: "error", message: data?.error || "Couldn’t disconnect WhatsApp." });
        return;
      }
      setLinked(false);
      setCode(null);
      toast({ title: "Disconnected", message: "WhatsApp is no longer linked to this account." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="connection-app-card whatsapp-connection-card">
      <div className="connection-app-head">
        <span className="connection-app-icon" aria-hidden>
          <MessageCircle />
        </span>
        <div>
          <div className="connection-app-title-row">
            <h3>WhatsApp</h3>
            <span className={`connection-status-pill ${linked ? "is-connected" : "is-pending"}`}>
              {linked ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="muted">
            {linked
              ? "Nura can send check-ins and updates to your WhatsApp."
              : "Link WhatsApp so Nura can follow up outside the app."}
          </p>
        </div>
      </div>

      {!hasPlus && (
        <p className="connection-plus-note">
          WhatsApp follow-up is included with Nura Plus or an active trial.{" "}
          <Link href="/billing">Manage billing</Link>
        </p>
      )}

      {usesWhatsapp && !linked && (
        <p className="connection-channel-note">
          Your preferred channel is set to {preferredChannel === "both" ? "WhatsApp + in app" : "WhatsApp"}. Connect
          WhatsApp here so those check-ins can actually reach you.{" "}
          <Link href="/me/preferences">Change preference</Link>
        </p>
      )}

      {linked ? (
        <div className="connection-app-body">
          <p className="connection-success-line">
            <CheckCircle2 size={16} /> Linked and ready for check-ins
          </p>
          <div className="connection-app-actions">
            <WhatsAppOpenButton className="secondary-cta" linked>
              Open WhatsApp
            </WhatsAppOpenButton>
            <button type="button" className="secondary-cta" onClick={refreshStatus} disabled={busy}>
              <RefreshCw size={16} /> {busy ? "Checking…" : "Refresh"}
            </button>
            <button type="button" className="ghost-danger-btn" onClick={disconnect} disabled={busy}>
              <Unplug size={16} /> Disconnect
            </button>
          </div>
        </div>
      ) : (
        <div className="connection-app-body">
          <ol className="connection-steps">
            <li>Tap connect to open WhatsApp with a short link message.</li>
            <li>Send that message to Nura from your phone.</li>
            <li>Come back here and refresh — status should show Connected.</li>
          </ol>
          {code && (
            <p className="connection-code-line">
              Pending link code: <code>{code}</code>
            </p>
          )}
          <div className="connection-app-actions">
            <WhatsAppOpenButton className="primary-cta" linked={false}>
              Connect WhatsApp
            </WhatsAppOpenButton>
            <button type="button" className="secondary-cta" onClick={refreshStatus} disabled={busy}>
              <RefreshCw size={16} /> {busy ? "Checking…" : "I’ve sent the message"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
