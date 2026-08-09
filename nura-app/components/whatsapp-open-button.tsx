"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useToast } from "@/components/toast";
import { track } from "@/lib/analytics";

export function WhatsAppOpenButton({
  className = "secondary-cta",
  children,
  message,
  linked = false,
  iconOnly = false,
  source = "unknown",
}: {
  className?: string;
  children?: React.ReactNode;
  message?: string;
  linked?: boolean;
  iconOnly?: boolean;
  source?: string;
}) {
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);
  const label = children ?? (linked ? "Chat via WhatsApp" : "Connect WhatsApp");

  async function openWhatsapp() {
    if (opening) return;
    setOpening(true);
    track("whatsapp_connect_click", { linked, source });
    try {
      const params = message ? `?message=${encodeURIComponent(message)}` : "";
      const response = await fetch(`/api/whatsapp/link${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (response.status === 402 || data?.error === "plus_required") {
        track("whatsapp_plus_required", { source });
        toast({
          tone: "warning",
          title: "Nura Plus needed",
          message: "Renew Plus to keep chatting on WhatsApp after a trial or subscription ends.",
        });
        return;
      }

      if (!response.ok || !data?.href) {
        track("whatsapp_connect_fail", { source, error: data?.error || "open_failed" });
        toast({
          tone: "warning",
          title: "WhatsApp isn’t ready",
          message:
            data?.error === "WhatsApp number is not configured."
              ? "Nura’s WhatsApp business number isn’t set. Update NEXT_PUBLIC_NURA_WHATSAPP_NUMBER."
              : data?.error || "Couldn’t open WhatsApp. Try again in a moment.",
        });
        return;
      }

      track("whatsapp_connect_opened", { linked, source });
      window.open(data.href, "_blank", "noopener,noreferrer");
    } catch {
      track("whatsapp_connect_fail", { source, error: "network" });
      toast({
        tone: "error",
        title: "Couldn’t open WhatsApp",
        message: "Check your connection and try again.",
      });
    } finally {
      setOpening(false);
    }
  }

  if (iconOnly) {
    const title = opening ? "Opening..." : (linked ? "Chat via WhatsApp" : "Connect WhatsApp");
    return (
      <button type="button" className={className} onClick={openWhatsapp} disabled={opening} title={title} aria-label={title}>
        <Send />
      </button>
    );
  }

  return (
    <button type="button" className={className} onClick={openWhatsapp} disabled={opening}>
      <Send /> {opening ? "Opening..." : label}
    </button>
  );
}
