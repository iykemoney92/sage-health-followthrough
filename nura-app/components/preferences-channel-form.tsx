"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const OPTIONS = [
  { value: "whatsapp", label: "WhatsApp", hint: "Messages and voice check-ins" },
  { value: "in_app", label: "In app", hint: "Notifications inside Nura" },
  { value: "both", label: "Both", hint: "Use both channels" },
] as const;

export function PreferencesChannelForm({ initialChannel }: { initialChannel: string }) {
  const router = useRouter();
  const [channel, setChannel] = useState(initialChannel);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function choose(value: string) {
    if (value === channel) return;
    const previous = channel;
    setChannel(value);
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch("/api/profile/channel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setChannel(previous);
        setNotice("Could not save that. Please try again.");
        return;
      }
      setNotice("Follow-up channel updated.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h3>Follow-up channel</h3>
      {OPTIONS.map((option) => (
        <label className="radio-row" key={option.value}>
          <input
            type="radio"
            name="channel"
            checked={channel === option.value}
            disabled={saving}
            onChange={() => choose(option.value)}
          />
          {" "}{option.label} <small>{option.hint}</small>
        </label>
      ))}
      {notice && <p className="profile-save-note">{notice}</p>}
    </section>
  );
}
