"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { useToast } from "@/components/toast";

export function WhatsAppOpenButton({
  className = "secondary-cta",
  children,
  message,
  linked = false,
  iconOnly = false,
}: {
  className?: string;
  children?: React.ReactNode;
  message?: string;
  linked?: boolean;
  iconOnly?: boolean;
}) {
  const { toast } = useToast();
  const [opening, setOpening] = useState(false);
  const label = children ?? (linked ? "Chat via WhatsApp" : "Connect WhatsApp");

  async function openWhatsapp() {
    if (opening) return;
    setOpening(true);
    try {
      const params = message ? `?message=${encodeURIComponent(message)}` : "";
      const response = await fetch(`/api/whatsapp/link${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (response.status === 402 || data?.error === "plus_required") {
        toast({
          tone: "warning",
          title: "Nura Plus needed",
          message: "WhatsApp follow-up unlocks with Plus or an active trial.",
        });
        return;
      }

      if (!response.ok || !data?.href) {
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

      window.open(data.href, "_blank", "noopener,noreferrer");
    } catch {
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
