"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, MessageCircle, Phone, Smartphone } from "lucide-react";
import { useToast } from "@/components/toast";

const OPTIONS = [
  {
    value: "voice",
    label: "Phone call",
    hint: "A short voice check-in from Nura",
    Icon: Phone,
  },
  {
    value: "whatsapp",
    label: "WhatsApp text",
    hint: "A message that opens the check-in",
    Icon: MessageCircle,
  },
  {
    value: "in_app",
    label: "In the app",
    hint: "Browser or in-app notification only",
    Icon: Smartphone,
  },
] as const;

type Channel = "voice" | "whatsapp" | "in_app";

function defaultPreferred(channels: string[]): Channel {
  if (channels.includes("voice")) return "voice";
  if (channels.includes("whatsapp")) return "whatsapp";
  return "in_app";
}

export function CheckinChannelsForm({
  initialChannels,
  initialPreferred,
  whatsappLinked = false,
  hasPhone = false,
}: {
  initialChannels: string[];
  initialPreferred?: string | null;
  whatsappLinked?: boolean;
  hasPhone?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const seed = initialChannels.length > 0 ? initialChannels : ["voice", "whatsapp", "in_app"];
  const [channels, setChannels] = useState<string[]>(seed);
  const [preferred, setPreferred] = useState<Channel>(() => {
    if (
      (initialPreferred === "voice" || initialPreferred === "whatsapp" || initialPreferred === "in_app") &&
      seed.includes(initialPreferred)
    ) {
      return initialPreferred;
    }
    return defaultPreferred(seed);
  });
  const [saving, setSaving] = useState(false);

  async function save(nextChannels: string[], nextPreferred: Channel) {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/checkin-channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: nextChannels, preferred: nextPreferred }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast({ tone: "error", message: "Could not save that. Please try again." });
        return false;
      }
      if (data.preferred === "voice" || data.preferred === "whatsapp" || data.preferred === "in_app") {
        setPreferred(data.preferred);
      }
      if (Array.isArray(data.channels) && data.channels.length > 0) {
        setChannels(data.channels);
      }
      toast({ title: "Updated", message: "Check-in preferences saved." });
      router.refresh();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function toggle(value: string) {
    const wasEnabled = channels.includes(value);
    if (wasEnabled && channels.length === 1) {
      toast({ tone: "error", message: "Keep at least one channel on so Nura can still reach you." });
      return;
    }
    const previousChannels = channels;
    const previousPreferred = preferred;
    const next = wasEnabled ? channels.filter((c) => c !== value) : [...channels, value];
    const nextPreferred = next.includes(preferred) ? preferred : defaultPreferred(next);
    setChannels(next);
    setPreferred(nextPreferred);
    const ok = await save(next, nextPreferred);
    if (!ok) {
      setChannels(previousChannels);
      setPreferred(previousPreferred);
    }
  }

  async function choosePreferred(value: Channel) {
    if (!channels.includes(value) || value === preferred) return;
    const previous = preferred;
    setPreferred(value);
    const ok = await save(channels, value);
    if (!ok) setPreferred(previous);
  }

  const needsWhatsapp = channels.includes("whatsapp") && !whatsappLinked;
  const needsPhone = channels.includes("voice") && !hasPhone;
  const outboundChoices = (["voice", "whatsapp"] as const).filter((c) => channels.includes(c));

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

      {outboundChoices.length > 1 && (
        <div className="pref-preferred-mode" role="group" aria-label="Preferred check-in mode">
          <p className="muted">When both are on, prefer:</p>
          <div className="pref-preferred-toggle">
            {outboundChoices.map((value) => {
              const label = value === "voice" ? "Call" : "WhatsApp";
              const active = preferred === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  className={`pref-preferred-btn ${active ? "is-active" : ""}`}
                  disabled={saving}
                  onClick={() => choosePreferred(value)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
