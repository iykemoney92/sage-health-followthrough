"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast";
import type { CheckinStyle, QuietHoursSettings } from "@/lib/profile-settings";

const STYLE_OPTIONS: Array<{ value: CheckinStyle; label: string; hint: string }> = [
  { value: "gentle", label: "Gentle and concise", hint: "Warm, short, easy to act on" },
  { value: "conversational", label: "More conversational", hint: "Chatty, open, and supportive" },
  { value: "brief", label: "Very brief", hint: "Just the essentials" },
];

export function PreferencesExtrasForm({
  initialQuietHours,
  initialStyle,
}: {
  initialQuietHours: QuietHoursSettings;
  initialStyle: CheckinStyle;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [quietHours, setQuietHours] = useState(initialQuietHours);
  const [style, setStyle] = useState<CheckinStyle>(initialStyle);
  const [saving, setSaving] = useState(false);

  async function save(nextQuiet: QuietHoursSettings, nextStyle: CheckinStyle) {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preferences",
          quietHoursEnabled: nextQuiet.enabled,
          quietHoursStart: nextQuiet.start,
          quietHoursEnd: nextQuiet.end,
          quietHoursAllowUrgent: nextQuiet.allowUrgent,
          checkinStyle: nextStyle,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast({ tone: "error", message: "Could not save preferences. Please try again." });
        return false;
      }
      toast({ title: "Saved", message: "Your follow-up preferences are up to date." });
      router.refresh();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function toggleQuiet(enabled: boolean) {
    const next = { ...quietHours, enabled };
    setQuietHours(next);
    const ok = await save(next, style);
    if (!ok) setQuietHours(quietHours);
  }

  async function saveQuietTimes() {
    const ok = await save(quietHours, style);
    if (!ok) setQuietHours(initialQuietHours);
  }

  async function chooseStyle(value: CheckinStyle) {
    if (value === style) return;
    const previous = style;
    setStyle(value);
    const ok = await save(quietHours, value);
    if (!ok) setStyle(previous);
  }

  return (
    <>
      <section className="pref-panel">
        <div className="pref-panel-head">
          <h3>Quiet hours</h3>
          <p className="muted">Pause non-urgent reminders overnight. Urgent safety notices can still get through.</p>
        </div>
        <label className="pref-switch-row">
          <span>
            <b>Enable quiet hours</b>
            <small>Hold gentle check-ins between these times</small>
          </span>
          <input
            type="checkbox"
            checked={quietHours.enabled}
            disabled={saving}
            onChange={(event) => void toggleQuiet(event.target.checked)}
          />
        </label>
        <div className={`pref-time-row ${quietHours.enabled ? "" : "is-disabled"}`}>
          <label>
            From
            <input
              type="time"
              value={quietHours.start}
              disabled={saving || !quietHours.enabled}
              onChange={(event) => setQuietHours((prev) => ({ ...prev, start: event.target.value }))}
            />
          </label>
          <label>
            Until
            <input
              type="time"
              value={quietHours.end}
              disabled={saving || !quietHours.enabled}
              onChange={(event) => setQuietHours((prev) => ({ ...prev, end: event.target.value }))}
            />
          </label>
        </div>
        <label className="pref-switch-row">
          <span>
            <b>Allow urgent safety notifications</b>
            <small>Still surface crisis-level alerts during quiet hours</small>
          </span>
          <input
            type="checkbox"
            checked={quietHours.allowUrgent}
            disabled={saving || !quietHours.enabled}
            onChange={(event) => {
              const next = { ...quietHours, allowUrgent: event.target.checked };
              setQuietHours(next);
              void save(next, style).then((ok) => {
                if (!ok) setQuietHours(quietHours);
              });
            }}
          />
        </label>
        {quietHours.enabled && (
          <button type="button" className="secondary-cta" onClick={() => void saveQuietTimes()} disabled={saving}>
            {saving ? "Saving…" : "Save quiet hours"}
          </button>
        )}
      </section>

      <section className="pref-panel">
        <div className="pref-panel-head">
          <h3>Check-in style</h3>
          <p className="muted">How chatty Nura should sound when she follows up.</p>
        </div>
        <div className="pref-choice-grid" role="radiogroup" aria-label="Check-in style">
          {STYLE_OPTIONS.map((option) => {
            const selected = style === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`pref-choice-card ${selected ? "is-selected" : ""}`}
                disabled={saving}
                onClick={() => void chooseStyle(option.value)}
              >
                <span className="pref-choice-copy">
                  <b>{option.label}</b>
                  <small>{option.hint}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
