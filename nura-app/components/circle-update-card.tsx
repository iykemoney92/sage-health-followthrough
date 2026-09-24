"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type { CircleUpdate } from "@/lib/care-circle-updates";

type Props = {
  planId: string;
  role: "owner" | "watcher";
  ownerFirstName: string;
  initial: CircleUpdate | null;
};

function formatWritten(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * Nura's update for the circle. Watchers see it as the thing to read; owners see the exact
 * same text under "What your circle sees", so what their family is told is never a secret.
 * A watcher opening a plan that has no update yet asks for one straight away.
 */
export function CircleUpdateCard({ planId, role, ownerFirstName, initial }: Props) {
  const [update, setUpdate] = useState<CircleUpdate | null>(initial);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");

  async function request(force: boolean) {
    if (writing) return;
    setWriting(true);
    setError("");
    try {
      const res = await fetch(`/api/plans/${planId}/circle-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(res.status === 429 ? "Nura has written a few of these recently - try again a little later." : "Couldn't write an update just now.");
        return;
      }
      setUpdate(data.update);
    } catch {
      setError("Couldn't write an update just now.");
    } finally {
      setWriting(false);
    }
  }

  // A watcher landing on a plan with no update yet shouldn't stare at "No update yet" - ask
  // Nura straight away. Deferred a tick so the first paint is the loading state, not a stall.
  useEffect(() => {
    if (initial || role !== "watcher") return;
    const timer = window.setTimeout(() => void request(false), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="detail-card circle-update-card" aria-label="Update for the Care circle">
      <div className="circle-update-head">
        <h3>
          <Sparkles aria-hidden /> {role === "owner" ? "What your circle sees" : `How ${ownerFirstName} is getting on`}
        </h3>
        <button
          type="button"
          className="circle-update-refresh"
          onClick={() => request(role === "owner")}
          disabled={writing}
          aria-label={role === "owner" ? "Write a fresh update" : "Refresh update"}
        >
          <RefreshCw className={writing ? "spin" : ""} /> {writing ? "Writing…" : role === "owner" ? "Write fresh" : "Refresh"}
        </button>
      </div>
      {role === "owner" && (
        <p className="circle-update-intro">
          Nura writes this for the people in your circle from your plan, roadmap and check-ins - never from your conversation. You always see exactly what they see.
        </p>
      )}
      {update ? (
        <>
          <p className="circle-update-body">{update.body}</p>
          <small className="circle-update-meta">Written by Nura · {formatWritten(update.createdAt)}</small>
        </>
      ) : writing ? (
        <p className="circle-update-body muted">Nura is writing this week&apos;s update…</p>
      ) : (
        <p className="circle-update-body muted">No update yet.</p>
      )}
      {error && <p className="circle-update-error">{error}</p>}
    </section>
  );
}
