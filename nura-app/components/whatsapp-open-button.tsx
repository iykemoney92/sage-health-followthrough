"use client";

import { useState } from "react";
import { Send } from "lucide-react";

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
  const [opening, setOpening] = useState(false);
  const label = children ?? (linked ? "Chat via WhatsApp" : "Connect WhatsApp");

  async function openWhatsapp() {
    if (opening) return;
    setOpening(true);
    try {
      const params = message ? `?message=${encodeURIComponent(message)}` : "";
      const response = await fetch(`/api/whatsapp/link${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (data?.href) {
        window.open(data.href, "_blank", "noopener,noreferrer");
      }
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
