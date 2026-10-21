"use client";

import { useState } from "react";

export function StopCircleEmailsButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function stop() {
    if (state === "busy" || state === "done") return;
    setState("busy");
    try {
      const res = await fetch("/api/circle/email-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => null);
      setState(res.ok && data?.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p className="join-note">Done - you won&apos;t get these emails any more.</p>;
  }

  return (
    <div className="join-actions">
      <button type="button" className="primary-cta" onClick={stop} disabled={state === "busy"}>
        {state === "busy" ? "Stopping…" : "Stop these emails"}
      </button>
      {state === "error" && <p className="join-note">Couldn&apos;t do that just now. Please try again.</p>}
    </div>
  );
}
