"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  token: string;
  status: "valid" | "used" | "expired" | "invalid";
  signedIn: boolean;
  isOwner: boolean;
  alreadyMine: boolean;
  planId: string | null;
  ownerName: string;
};

export function JoinCircleActions({ token, status, signedIn, isOwner, alreadyMine, planId, ownerName }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"join" | "skip" | null>(null);
  const [error, setError] = useState("");

  // Signed-out visitor: remember the invite so that whichever way they end up with an
  // account - email, Google, Apple - the app brings them straight back here.
  useEffect(() => {
    if (signedIn || status !== "valid") return;
    void fetch("/api/circle/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
  }, [signedIn, status, token]);

  async function join() {
    if (busy) return;
    setBusy("join");
    setError("");
    try {
      const res = await fetch("/api/circle/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(
          data?.error === "used"
            ? "Someone has already used this invite."
            : data?.error === "expired"
              ? "This invite has expired - ask for a new link."
              : data?.error === "owner"
                ? "This is your own Care plan."
                : "Couldn't join just now. Please try again.",
        );
        return;
      }
      router.replace(`/plans/${data.planId}`);
      router.refresh();
    } catch {
      setError("Couldn't join just now. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function notNow() {
    if (busy) return;
    setBusy("skip");
    try {
      await fetch("/api/circle/join", { method: "DELETE" }).catch(() => null);
    } finally {
      router.replace(signedIn ? "/today" : "/");
    }
  }

  if (status === "invalid" || status === "expired") {
    return (
      <div className="join-actions">
        <Link href={signedIn ? "/today" : "/"} className="secondary-cta">
          {signedIn ? "Back to Nura" : "Go to Nura"}
        </Link>
      </div>
    );
  }

  if (status === "used") {
    return (
      <div className="join-actions">
        {alreadyMine && planId ? (
          <Link href={`/plans/${planId}`} className="primary-cta">
            Open {ownerName}&apos;s Care plan
          </Link>
        ) : (
          <Link href={signedIn ? "/today" : "/"} className="secondary-cta">
            {signedIn ? "Back to Nura" : "Go to Nura"}
          </Link>
        )}
      </div>
    );
  }

  if (!signedIn) {
    const next = encodeURIComponent(`/join/${token}`);
    return (
      <div className="join-actions">
        <Link href={`/signup?next=${next}`} className="primary-cta">
          Create a free account to join
        </Link>
        <Link href={`/login?next=${next}`} className="secondary-cta">
          I already have a Nura account
        </Link>
        <small>Joining is free. You won&apos;t be asked to pay.</small>
      </div>
    );
  }

  if (isOwner) {
    return (
      <div className="join-actions">
        <p className="join-note">This is your own Care plan - send the link to the person you want to join.</p>
        {planId && (
          <Link href={`/plans/${planId}`} className="secondary-cta">
            Back to the Care plan
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="join-actions">
      <button type="button" className="primary-cta" onClick={join} disabled={busy !== null}>
        {busy === "join" ? "Joining…" : `Join ${ownerName}'s Care circle`}
      </button>
      <button type="button" className="secondary-cta" onClick={notNow} disabled={busy !== null}>
        Not now
      </button>
      {error && <p className="join-error">{error}</p>}
    </div>
  );
}
