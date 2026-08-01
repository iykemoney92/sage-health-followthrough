"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageCircle, MonitorSmartphone, Smartphone } from "lucide-react";
import { useToast } from "@/components/toast";

const OPTIONS = [
  {
    value: "whatsapp",
    label: "WhatsApp",
    hint: "Check-ins and updates on WhatsApp",
    Icon: MessageCircle,
  },
  {
    value: "in_app",
    label: "In the app",
    hint: "Stay inside Nura for follow-ups",
    Icon: MonitorSmartphone,
  },
  {
    value: "both",
    label: "Both",
    hint: "WhatsApp plus in-app together",
    Icon: Smartphone,
  },
] as const;

export function PreferencesChannelForm({
  initialChannel,
  whatsappLinked = false,
}: {
  initialChannel: string;
  whatsappLinked?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [channel, setChannel] = useState(initialChannel);
  const [saving, setSaving] = useState(false);

  async function choose(value: string) {
    if (value === channel) return;
    const previous = channel;
    setChannel(value);
    setSaving(true);
    try {
      const res = await fetch("/api/profile/channel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setChannel(previous);
        toast({ tone: "error", message: "Could not save that. Please try again." });
        return;
      }
      toast({ title: "Updated", message: "Follow-up channel saved." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const needsWhatsapp = channel === "whatsapp" || channel === "both";

  return (
    <section className="pref-panel">
      <div className="pref-panel-head">
        <h3>Follow-up channel</h3>
        <p className="muted">Where scheduled check-ins and important updates should land.</p>
      </div>
      <div className="pref-choice-grid" role="radiogroup" aria-label="Follow-up channel">
        {OPTIONS.map((option) => {
          const selected = channel === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`pref-choice-card ${selected ? "is-selected" : ""}`}
              disabled={saving}
              onClick={() => choose(option.value)}
            >
              <span className="pref-choice-icon" aria-hidden>
                <option.Icon />
              </span>
              <span className="pref-choice-copy">
                <b>{option.label}</b>
                <small>{option.hint}</small>
              </span>
            </button>
          );
        })}
      </div>
      {needsWhatsapp && !whatsappLinked && (
        <p className="preference-whatsapp-hint">
          Link WhatsApp so this channel can actually reach you.{" "}
          <Link href="/me/connections">Open Connected apps</Link>
        </p>
      )}
      {needsWhatsapp && whatsappLinked && (
        <p className="pref-status-ok">WhatsApp is connected — check-ins can reach you there.</p>
      )}
    </section>
  );
}
