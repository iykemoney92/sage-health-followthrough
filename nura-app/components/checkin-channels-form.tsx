"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, MessageCircle, Phone, Smartphone } from "lucide-react";
import { useToast } from "@/components/toast";

const OPTIONS = [
  {
    value: "whatsapp",
    label: "WhatsApp text",
    hint: "A message that opens the check-in",
    Icon: MessageCircle,
  },
  {
    value: "voice",
    label: "Phone call",
    hint: "A short voice check-in from Nura",
    Icon: Phone,
  },
  {
    value: "in_app",
    label: "In the app",
    hint: "Browser or in-app notification only",
    Icon: Smartphone,
  },
] as const;

export function CheckinChannelsForm({
  initialChannels,
  whatsappLinked = false,
  hasPhone = false,
}: {
  initialChannels: string[];
  whatsappLinked?: boolean;
  hasPhone?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [channels, setChannels] = useState<string[]>(initialChannels.length > 0 ? initialChannels : ["whatsapp"]);
  const [saving, setSaving] = useState(false);

  async function toggle(value: string) {
    const wasEnabled = channels.includes(value);
    if (wasEnabled && channels.length === 1) {
      toast({ tone: "error", message: "Keep at least one channel on so Nura can still reach you." });
      return;
    }
    const previous = channels;
    const next = wasEnabled ? channels.filter((c) => c !== value) : [...channels, value];
    setChannels(next);
    setSaving(true);
    try {
      const res = await fetch("/api/profile/checkin-channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setChannels(previous);
        toast({ tone: "error", message: "Could not save that. Please try again." });
        return;
      }
      toast({ title: "Updated", message: "Check-in channels saved." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const needsWhatsapp = channels.includes("whatsapp") && !whatsappLinked;
  const needsPhone = channels.includes("voice") && !hasPhone;

  return (
    <section className="pref-panel">
      <div className="pref-panel-head">
        <h3>Proactive check-ins</h3>
        <p className="muted">How Nura may reach out first — pick every channel you’re happy with.</p>
      </div>
      <div className="pref-choice-grid pref-choice-grid-multi" role="group" aria-label="Proactive check-in channels">
        {OPTIONS.map((option) => {
          const selected = channels.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              className={`pref-choice-card ${selected ? "is-selected" : ""}`}
              disabled={saving}
              onClick={() => toggle(option.value)}
            >
              <span className="pref-choice-icon" aria-hidden>
                <option.Icon />
              </span>
              <span className="pref-choice-copy">
                <b>{option.label}</b>
                <small>{option.hint}</small>
              </span>
              <span className={`pref-choice-check ${selected ? "is-on" : ""}`} aria-hidden>
                <Check />
              </span>
            </button>
          );
        })}
      </div>
      {(needsWhatsapp || needsPhone) && (
        <p className="preference-whatsapp-hint">
          {needsWhatsapp && needsPhone
            ? "WhatsApp and phone check-ins need a linked number."
            : needsWhatsapp
              ? "WhatsApp check-ins need your number linked."
              : "Phone check-ins need a number on your profile."}{" "}
          <Link href={needsPhone && !needsWhatsapp ? "/me/profile" : "/me/connections"}>
            {needsPhone && !needsWhatsapp ? "Add a phone number" : "Open Connected apps"}
          </Link>
        </p>
      )}
    </section>
  );
}
