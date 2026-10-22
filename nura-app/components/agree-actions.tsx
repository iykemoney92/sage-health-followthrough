"use client";

import { useState } from "react";

type Status = "pending" | "expired" | "granted" | "declined" | "revoked" | "invalid";

/**
 * Yes / No thanks on the agreement page, and "stop the calls" once they've said yes. Written for
 * someone who may not use apps much: big buttons, one decision, plain confirmation afterwards.
 */
export function AgreeActions({
  token,
  initialStatus,
  recipientFirstName,
  ownerFirstName,
}: {
  token: string;
  initialStatus: Status;
  recipientFirstName: string;
  ownerFirstName: string;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [busy, setBusy] = useState<"yes" | "no" | "stop" | null>(null);
  const [error, setError] = useState("");

  async function answer(decision: "yes" | "no" | "stop") {
    if (busy) return;
    setBusy(decision);
    setError("");
    try {
      const res = await fetch("/api/care-recipient/agree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(
          data?.error === "expired"
            ? `This link has run out. Ask ${ownerFirstName} to send you a new one.`
            : "That didn't go through. Please try again.",
        );
        return;
      }
      setStatus(data.status as Status);
    } catch {
      setError("That didn't go through. Please check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  if (status === "granted") {
    return (
      <div className="join-actions agree-actions">
        <p className="agree-done">
          Thank you, {recipientFirstName}. Nura will give you a short call soon. You can say &ldquo;stop&rdquo; on any call.
        </p>
        <button type="button" className="secondary-cta" onClick={() => answer("stop")} disabled={busy !== null}>
          {busy === "stop" ? "Stopping…" : "I've changed my mind - stop the calls"}
        </button>
        {error && <p className="join-error">{error}</p>}
      </div>
    );
  }

  if (status === "declined" || status === "revoked") {
    return (
      <div className="join-actions agree-actions">
        <p className="agree-done">
          That&apos;s fine - Nura won&apos;t call you. We&apos;ve let {ownerFirstName} know.
        </p>
      </div>
    );
  }

  if (status === "expired" || status === "invalid") {
    return (
      <div className="join-actions agree-actions">
        <p className="agree-done">
          {status === "expired"
            ? `This link has run out. Ask ${ownerFirstName} to send you a new one.`
            : "This link isn't working. Ask the person who sent it for a new one."}
        </p>
      </div>
    );
  }

  return (
    <div className="join-actions agree-actions">
      <button type="button" className="primary-cta" onClick={() => answer("yes")} disabled={busy !== null}>
        {busy === "yes" ? "Saving…" : "Yes, that's fine"}
      </button>
      <button type="button" className="secondary-cta" onClick={() => answer("no")} disabled={busy !== null}>
        {busy === "no" ? "Saving…" : "No thanks"}
      </button>
      {error && <p className="join-error">{error}</p>}
    </div>
  );
}
