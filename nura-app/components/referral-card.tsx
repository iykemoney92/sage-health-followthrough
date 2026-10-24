"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Copy, Gift, MessageCircle, Share2, X } from "lucide-react";
import { useIsNativeShell } from "@/components/platform-copy";
import { track } from "@/lib/analytics";
import { referralShareText, referralWhatsappUrl } from "@/lib/referral-share";

type Link = { url: string; joined: number };

const RAIL_DISMISSED_KEY = "nura_referral_rail_dismissed";

// Neither navigator.share nor localStorage exists on the server, so both are read as external
// stores: the server (and first paint) says "can't share" and "rail hidden".
const noopSubscribe = () => () => {};
const clientCanShare = () => typeof navigator.share === "function";
const clientRailDismissed = () => {
  try {
    return window.localStorage.getItem(RAIL_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * "Tell a friend": the person's own invite link with WhatsApp, copy and (where the browser has
 * it) the system share sheet. The Me page always has it; Today shows a smaller one after the
 * first finished check-in, which can be put away for good.
 */
export function ReferralCard({ surface }: { surface: "me" | "today" }) {
  const isNative = useIsNativeShell();
  const [link, setLink] = useState<Link | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(noopSubscribe, clientCanShare, () => false);
  const railDismissed = useSyncExternalStore(noopSubscribe, clientRailDismissed, () => true);
  const [justDismissed, setJustDismissed] = useState(false);
  const dismissed = surface === "today" && (railDismissed || justDismissed);

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    fetch("/api/referrals/me")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && typeof data.url === "string") {
          setLink({ url: data.url, joined: Number(data.joined) || 0 });
          track("referral_link_view", { surface });
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [surface, dismissed]);

  if (dismissed) return null;
  if (surface === "today" && (failed || !link)) return null;

  // Inside the app the message is a plain recommendation; the landing page explains the gift.
  const text = link ? referralShareText(link.url, { mentionGift: !isNative }) : "";

  async function shareNative() {
    if (!link) return;
    try {
      await navigator.share({ text });
      track("referral_share", { method: "share_sheet", surface });
    } catch {
      // Closing the share sheet rejects too; nothing to tell anyone.
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      track("referral_share", { method: "copy", surface });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  }

  function dismiss() {
    try {
      window.localStorage.setItem(RAIL_DISMISSED_KEY, "1");
    } catch {}
    track("referral_rail_dismiss");
    setJustDismissed(true);
  }

  const buttons = link ? (
    <div className="button-row">
      {canShare ? (
        <button type="button" className="primary-cta" onClick={shareNative}>
          <Share2 /> Share
        </button>
      ) : null}
      <a
        href={referralWhatsappUrl(text)}
        target="_blank"
        rel="noopener noreferrer"
        className={canShare ? "secondary-cta" : "primary-cta"}
        onClick={() => track("referral_share", { method: "whatsapp", surface })}
      >
        <MessageCircle /> WhatsApp
      </a>
      <button type="button" className="secondary-cta" onClick={copyLink}>
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  ) : null;

  if (surface === "today") {
    return (
      <article className="rail-card referral-rail-card" aria-label="Tell a friend about Nura">
        <button type="button" className="referral-dismiss" aria-label="Hide this" onClick={dismiss}>
          <X />
        </button>
        <h3>
          <Gift aria-hidden /> Know someone who&apos;d use this?
        </h3>
        <p>{isNative ? "Share Nura with someone juggling appointments or medicines." : "Give a friend 30 days of Nura Plus, free. No card needed."}</p>
        <div className="care-circle-invite referral-invite">{buttons}</div>
      </article>
    );
  }

  return (
    <div className="detail-card referral-card">
      <p className="referral-intro">
        {isNative
          ? "Know someone juggling appointments or medicines? Send them your personal link to Nura."
          : "Share your link. A friend who joins gets 30 days of Nura Plus free, with no card needed."}
      </p>
      {link ? (
        <div className="care-circle-invite referral-invite">
          <label>
            <span>Your invite link</span>
            <input type="text" readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} />
          </label>
          {buttons}
          <small>
            {link.joined > 0
              ? `${link.joined} ${link.joined === 1 ? "person has" : "people have"} joined through your link. `
              : ""}
            The link and message say nothing about your health. You only ever see how many people joined, not who.
          </small>
        </div>
      ) : failed ? (
        <p className="care-circle-error">Couldn&apos;t load your link just now. Please try again later.</p>
      ) : (
        <p className="referral-loading">Getting your link…</p>
      )}
    </div>
  );
}
