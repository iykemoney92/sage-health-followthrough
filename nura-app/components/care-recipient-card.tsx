"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, MessageCircle, MessageSquareText, PhoneCall, PhoneOff } from "lucide-react";

export type RecipientSummary = {
  firstName: string;
  relationship: string;
  phoneMasked: string;
  timeZone: string;
  consentStatus: "pending" | "granted" | "declined" | "revoked";
  consentMethod: "link" | "on_behalf" | null;
  consentAt: string | null;
};

export type ConsentShareLinks = { url: string; text: string; whatsappUrl: string; smsUrl: string; expiresAt: string };

/**
 * Owner-side card for a plan about someone else: who Nura calls, whether they've agreed, and the
 * three things the owner can do - send them the link to agree, confirm they agree on their
 * behalf, or stop the calls.
 */
export type LastRecipientCall = { at: string; summary: string | null };

function formatCallWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function CareRecipientCard({
  planId,
  initial,
  lastCall = null,
}: {
  planId: string;
  initial: RecipientSummary;
  lastCall?: LastRecipientCall | null;
}) {
  const [recipient, setRecipient] = useState(initial);
  const [share, setShare] = useState<ConsentShareLinks | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"link" | "on_behalf" | "stop" | null>(null);
  const [needsPlus, setNeedsPlus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const name = recipient.firstName;

  async function act(action: "link" | "on_behalf" | "stop") {
    if (busy) return;
    setBusy(action);
    setError("");
    try {
      const res = await fetch(`/api/plans/${planId}/recipient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 402) {
        setNeedsPlus(true);
        return;
      }
      if (!res.ok || !data?.ok) {
        setError("That didn't save just now. Please try again.");
        return;
      }
      setRecipient(data.recipient as RecipientSummary);
      setShare(action === "link" ? (data.share as ConsentShareLinks) : null);
      setConfirming(false);
    } catch {
      setError("That didn't save just now. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy - long-press the link to copy it instead.");
    }
  }

  const statusLine =
    recipient.consentStatus === "granted"
      ? recipient.consentMethod === "on_behalf"
        ? `You confirmed ${name} is happy to get calls.`
        : `${name} said yes to check-in calls.`
      : recipient.consentStatus === "pending"
        ? `Waiting for ${name} to say yes. Nura won't call until they do.`
        : recipient.consentStatus === "declined"
          ? `${name} said no thanks, so Nura won't call.`
          : `Calls to ${name} are stopped.`;

  return (
    <section className="detail-card care-circle-card care-recipient-card" aria-label={`Calls to ${name}`}>
      <h3>
        <PhoneCall aria-hidden /> Nura checks in with {name}
      </h3>
      <p className="care-circle-intro">
        {`Nura calls ${name} on ${recipient.phoneMasked} during their daytime (${recipient.timeZone.replace(/_/g, " ")}) and tells you how it went. ${name} can say “stop” on any call.`}
      </p>
      <p className={`care-recipient-status ${recipient.consentStatus}`} role="status">
        {statusLine}
      </p>

      {lastCall && (
        <div className="care-recipient-last-call">
          <small>{`Last call · ${formatCallWhen(lastCall.at)}`}</small>
          <p>{lastCall.summary || `Nura spoke with ${name}. No summary was available for this call.`}</p>
        </div>
      )}

      {needsPlus ? (
        <div className="care-circle-invite care-circle-upsell">
          <b>Calls to someone you care for are part of Nura Plus.</b>
          <Link href="/billing" className="primary-cta">
            See Nura Plus
          </Link>
        </div>
      ) : share ? (
        <div className="care-circle-invite">
          <label>
            <span>Send {name} this message</span>
            <textarea readOnly rows={4} value={share.text} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <div className="button-row">
            <a href={share.whatsappUrl} target="_blank" rel="noopener noreferrer" className="primary-cta">
              <MessageCircle /> WhatsApp
            </a>
            <a href={share.smsUrl} className="secondary-cta">
              <MessageSquareText /> Text
            </a>
            <button type="button" className="secondary-cta" onClick={copyLink}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <small>The link lets {name} say yes or no for the next 7 days, and stop the calls any time after.</small>
        </div>
      ) : null}

      {recipient.consentStatus === "granted" ? (
        <button type="button" className="secondary-cta care-recipient-stop" onClick={() => act("stop")} disabled={busy !== null}>
          <PhoneOff /> {busy === "stop" ? "Stopping…" : `Stop calls to ${name}`}
        </button>
      ) : !needsPlus ? (
        <div className="care-recipient-actions">
          {!share && (
            <button type="button" className="primary-cta" onClick={() => act("link")} disabled={busy !== null}>
              <MessageCircle /> {busy === "link" ? "Making link…" : `Send ${name} the link to agree`}
            </button>
          )}
          {confirming ? (
            <div className="care-recipient-confirm">
              <p>
                {`Only do this if ${name} knows about Nura and is happy to get calls. On the first call, Nura will say you set it up and that they can say “stop” any time.`}
              </p>
              <div className="button-row">
                <button type="button" className="primary-cta" onClick={() => act("on_behalf")} disabled={busy !== null}>
                  {busy === "on_behalf" ? "Saving…" : `Yes, ${name} agrees`}
                </button>
                <button type="button" className="secondary-cta" onClick={() => setConfirming(false)} disabled={busy !== null}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="text-link care-recipient-behalf" onClick={() => setConfirming(true)}>
              {name} is with me and agrees - accept for them
            </button>
          )}
        </div>
      ) : null}

      {error && <p className="care-circle-error">{error}</p>}
    </section>
  );
}
