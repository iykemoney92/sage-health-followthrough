"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

/** Watcher preference: get this plan's weekly update and missed check-in alerts by email. */
export function CircleEmailToggle({ planId, initialEnabled }: { planId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle(next: boolean) {
    if (saving) return;
    setSaving(true);
    setError("");
    const previous = enabled;
    setEnabled(next);
    try {
      const res = await fetch(`/api/plans/${planId}/circle/email`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setEnabled(previous);
        setError("Couldn't save that just now. Please try again.");
      }
    } catch {
      setEnabled(previous);
      setError("Couldn't save that just now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="circle-email-toggle">
      <label className="care-circle-toggle">
        <input type="checkbox" checked={enabled} disabled={saving} onChange={(event) => void toggle(event.target.checked)} />
        <span className="care-circle-toggle-text">
          <b>
            <Mail aria-hidden /> Email me updates
          </b>
          <small>The weekly update, anything passed on to you, and missed check-in alerts if they&apos;re switched on.</small>
        </span>
      </label>
      {error && <p className="care-circle-error">{error}</p>}
    </div>
  );
}
