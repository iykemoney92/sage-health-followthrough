"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";
import { isNative, nativePlatform, nativePushReady, usePushNotifications } from "@/components/push-notifications-toggle";

const SEEN_KEY = "nura.pushAsk.seen";

/**
 * A one-time ask on Today for people using the iOS/Android app who already have a Care plan but
 * never turned notifications on. New users are asked during onboarding; this reaches everyone who
 * installed before Android push was switched on (11 Nov 2026), or who skipped that step.
 *
 * Shown once per device: tapping either button records it (on iPhone, being shown does), and it
 * never shows on the web, where the settings toggle already covers browser notifications.
 */
export function PushAskCard({ show }: { show: boolean }) {
  const eligible = show && isNative && nativePushReady;
  const { status, busy, enable } = usePushNotifications();
  const [seen, setSeen] = useState(true);

  useEffect(() => {
    if (!eligible) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeen(Boolean(localStorage.getItem(SEEN_KEY)));
    } catch {
      setSeen(true);
    }
  }, [eligible]);

  const visible = eligible && !seen && status === "off";

  // App Store guideline 5.1.1(iv): on iPhone a message before the system permission prompt may not
  // offer a way out, so there the card has only "Turn on" and counts as seen once it has shown.
  // It sits inline on Today and blocks nothing; scrolling past it is the "no".
  const ios = nativePlatform === "ios";

  useEffect(() => {
    if (!visible) return;
    track("push_ask_shown", { platform: nativePlatform });
    if (ios) {
      try {
        localStorage.setItem(SEEN_KEY, `shown:${Date.now()}`);
      } catch {
        // Private storage blocked: the card may show again next time.
      }
    }
  }, [visible, ios]);

  if (!visible && !(eligible && !seen && busy)) return null;

  function markSeen(outcome: "enable" | "dismiss") {
    try {
      localStorage.setItem(SEEN_KEY, `${outcome}:${Date.now()}`);
    } catch {
      // Private storage blocked: the card simply may show again next time.
    }
  }

  async function onEnable() {
    track("push_ask_click", { platform: nativePlatform });
    markSeen("enable");
    await enable();
    setSeen(true);
  }

  function onDismiss() {
    track("push_ask_dismiss", { platform: nativePlatform });
    markSeen("dismiss");
    setSeen(true);
  }

  return (
    <section className="today-push-ask" aria-label="Turn on notifications">
      <div>
        <strong>Let Nura’s check-ins reach you</strong>
        <p>Turn on notifications and you’ll get a gentle nudge on this phone when a check-in is due, even when the app is closed.</p>
      </div>
      <div className="today-push-ask-actions">
        <button type="button" className="primary-cta" onClick={onEnable} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <BellRing size={16} />} Turn on
        </button>
        {ios ? null : (
          <button type="button" className="today-push-ask-later" onClick={onDismiss} disabled={busy}>
            Not now
          </button>
        )}
      </div>
    </section>
  );
}
