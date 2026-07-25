"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export function WhatsAppOpenButton({
  className = "secondary-cta",
  children,
  message,
  linked = false,
}: {
  className?: string;
  children?: React.ReactNode;
  message?: string;
  linked?: boolean;
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

  return (
    <button type="button" className={className} onClick={openWhatsapp} disabled={opening}>
      <Send /> {opening ? "Opening..." : label}
    </button>
  );
}
