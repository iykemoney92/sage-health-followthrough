"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * The agree half of the consent gate.
 *
 * Deliberately not pre-ticked and not dismissible: the gate is the only route
 * into the product, so agreeing has to be a deliberate tap rather than something
 * that happens by scrolling past.
 */
export function AiConsentActions({ next }: { next: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agree() {
    setError(null);
    setSaving(true);
    track("ai_consent_granted");

    const ok = await fetch("/api/ai-consent", { method: "POST" })
      .then((response) => response.ok)
      .catch(() => false);

    if (!ok) {
      setError("We couldn’t save that. Check your connection and try again.");
      setSaving(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="primary-cta billing-lock-cta" onClick={agree} disabled={saving}>
        <ShieldCheck size={18} /> {saving ? "Saving…" : "Agree and continue"}
      </button>
      {error && (
        <p className="auth-provider-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
