"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { track } from "@/lib/analytics";
import { StoreBadges } from "@/components/store-badges";
import { isNative, nativePlatform, nativePushReady, usePushNotifications } from "@/components/push-notifications-toggle";
import { checkHealthAvailability, healthConnectGrantedCount, nativeHealthPlatform } from "@/lib/health/native-health";
import { HEALTH_PLATFORM_LABELS, type HealthPlatform } from "@/lib/health/metrics";

const SEEN_KEY = "nura.healthAsk.seen";
const NO_DATA_SEEN_KEY = "nura.healthAsk.noData.seen";
const PUSH_SEEN_KEY = "nura.pushAsk.seen";

type Connection = { platform: HealthPlatform; last_sync_status: "ok" | "no_data" | "error" | null };
type Variant =
  | { kind: "connect"; platform: HealthPlatform }
  | { kind: "web" }
  | { kind: "no_data"; allowed: number | null };

function readKey(key: string) {
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    return true; // storage blocked: don't nag on every visit
  }
}

function writeKey(key: string, value: string) {
  try {
    localStorage.setItem(key, `${value}:${Date.now()}`);
  } catch {
    // Private storage blocked: the card may show again next time.
  }
}

/**
 * Asks people with a Care plan to connect Apple Health or Health Connect, from Today.
 * Onboarding asks once; this reaches everyone who skipped setup, said "Not now", or signed
 * up on the website (where it points to the app). On Android it also catches a connection
 * that synced nothing, and links to Me → Connections, which says what to fix.
 *
 * Once per device per variant. Waits while the notifications card is showing, so the two
 * never stack. On iPhone there is no "Not now" (App Store 5.1.1(iv), as with the push card):
 * the card counts as seen once shown and scrolling past it is the "no".
 */
export function HealthAskCard({ show }: { show: boolean }) {
  const { status: pushStatus } = usePushNotifications();
  const [variant, setVariant] = useState<Variant | null>(null);
  const [hidden, setHidden] = useState(false);

  const pushCardPending = isNative && nativePushReady && pushStatus === "off" && !readKeySafe(PUSH_SEEN_KEY);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    void (async () => {
      const availability = await checkHealthAvailability();
      if (availability.state === "update_app" || availability.state === "unavailable") return;
      const platform = nativeHealthPlatform();
      const url = platform ? `/api/health/connection?platform=${platform}` : "/api/health/connection";
      const response = await fetch(url, { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const body = (await response.json().catch(() => null)) as {
        connection: Connection | null;
        other_platforms?: HealthPlatform[];
      } | null;
      if (!body || cancelled) return;

      let next: Variant | null = null;
      if (availability.state === "web") {
        if (!body.connection && (body.other_platforms ?? []).length === 0 && !readKey(SEEN_KEY)) next = { kind: "web" };
      } else if (!body.connection) {
        if (!readKey(SEEN_KEY)) next = { kind: "connect", platform: availability.platform };
      } else if (body.connection.last_sync_status === "no_data" && body.connection.platform === "health_connect") {
        if (!readKey(NO_DATA_SEEN_KEY)) next = { kind: "no_data", allowed: await healthConnectGrantedCount() };
      }
      if (!cancelled) setVariant(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [show]);

  const visible = Boolean(show && variant && !hidden && !pushCardPending);
  const ios = nativePlatform === "ios";
  const seenKey = variant?.kind === "no_data" ? NO_DATA_SEEN_KEY : SEEN_KEY;

  useEffect(() => {
    if (!visible || !variant) return;
    track("health_ask_shown", { variant: variant.kind, platform: nativePlatform ?? "web" });
    if (ios) writeKey(seenKey, "shown");
  }, [visible, variant, ios, seenKey]);

  if (!visible || !variant) return null;

  function onClick() {
    track("health_ask_click", { variant: variant!.kind, platform: nativePlatform ?? "web" });
    writeKey(seenKey, "click");
  }

  function onDismiss() {
    track("health_ask_dismiss", { variant: variant!.kind, platform: nativePlatform ?? "web" });
    writeKey(seenKey, "dismiss");
    setHidden(true);
  }

  const later = ios ? null : (
    <button type="button" className="today-push-ask-later" onClick={onDismiss}>
      Not now
    </button>
  );

  if (variant.kind === "web") {
    return (
      <section className="today-push-ask today-health-ask" aria-label="Connect your health data">
        <div>
          <strong>Let Nura see how you’re really sleeping</strong>
          <p>
            Connect Apple Health or Health Connect in the Nura app and check-ins can notice your sleep and steps, not just
            what you remember to say. Open the app and go to Me → Connections.
          </p>
          <StoreBadges placement="today_health_ask" compact />
        </div>
        <div className="today-push-ask-actions">{later}</div>
      </section>
    );
  }

  if (variant.kind === "no_data") {
    return (
      <section className="today-push-ask today-health-ask" aria-label="Health Connect has no data yet">
        <div>
          <strong>Nura can’t see any sleep or steps yet</strong>
          <p>
            {variant.allowed === 0
              ? "Health Connect is connected, but Nura isn’t allowed to read anything. It takes a few taps to fix."
              : "Health Connect only holds what other apps save to it, like Samsung Health, Google Fit or a watch app. It takes a minute to switch on."}
          </p>
        </div>
        <div className="today-push-ask-actions">
          <Link href="/me/connections" className="primary-cta" onClick={onClick}>
            <HeartPulse size={16} /> Show me how
          </Link>
          {later}
        </div>
      </section>
    );
  }

  const label = HEALTH_PLATFORM_LABELS[variant.platform];
  return (
    <section className="today-push-ask today-health-ask" aria-label={`Connect ${label}`}>
      <div>
        <strong>Let Nura see how you’re really sleeping</strong>
        <p>Connect {label} and check-ins can notice your sleep and steps, not just what you remember to say. You choose what it reads.</p>
      </div>
      <div className="today-push-ask-actions">
        <Link href="/me/health" className="primary-cta" onClick={onClick}>
          <HeartPulse size={16} /> Connect {label}
        </Link>
        {later}
      </div>
    </section>
  );
}

function readKeySafe(key: string) {
  if (typeof window === "undefined") return true;
  return readKey(key);
}
