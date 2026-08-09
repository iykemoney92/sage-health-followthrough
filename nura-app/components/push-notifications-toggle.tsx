"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { track } from "@/lib/analytics";

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

type Status = "checking" | "unsupported" | "denied" | "missing_key" | "off" | "on";

async function checkStatus(): Promise<Status> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "missing_key";
  if (Notification.permission === "denied") return "denied";

  // navigator.serviceWorker.ready only resolves once a service worker is active for this
  // origin - if enable() has never run, nothing has ever registered one, so .ready hangs
  // forever and the toggle would stay disabled permanently. getRegistration() resolves
  // immediately either way, so it's the right check before a subscription exists at all.
  const registration = await navigator.serviceWorker.getRegistration("/").catch(() => null);
  if (!registration) return "off";

  const subscription = await registration.pushManager.getSubscription().catch(() => null);
  return subscription ? "on" : "off";
}

export function PushNotificationsToggle({ autoRequest = false }: { autoRequest?: boolean } = {}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const autoRequestedRef = useRef(false);

  useEffect(() => {
    // Push/Notification APIs are browser-only; hydrate status after mount.
    void checkStatus().then(setStatus);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!autoRequest || autoRequestedRef.current || status !== "off") return;
    autoRequestedRef.current = true;
    void enable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequest, status]);

  async function enable() {
    setBusy(true);
    track("push_enable_click");
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
      if (!vapidKey) {
        setStatus("missing_key");
        toast({ tone: "error", message: "Push isn’t configured for this environment yet." });
        return;
      }

      if (!("Notification" in window)) {
        setStatus("unsupported");
        return;
      }

      const permission = await withTimeout(
        Notification.requestPermission(),
        30000,
        "Notification permission prompt didn’t resolve — check for a blocked popup or your OS notification settings.",
      );
      track("push_permission", { result: permission });
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        toast({
          tone: "info",
          message:
            permission === "denied"
              ? "Notifications are blocked in your browser settings."
              : "Permission wasn’t granted — you can try again later.",
        });
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      // Guarded the same way as checkStatus(): should be fast right after a fresh register(),
      // but a stalled install must never re-lock this button the way an unregistered worker did.
      await withTimeout(navigator.serviceWorker.ready, 10000, "Service worker took too long to activate.");

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing
        || (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; testSent?: number } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || "subscribe failed");
      }

      setStatus("on");
      track("push_enable_success", { test_sent: (payload.testSent ?? 0) > 0 });
      toast({
        title: "Notifications on",
        message:
          (payload.testSent ?? 0) > 0
            ? "You’ll get a test one now."
            : "Saved — check-ins can reach this browser.",
      });
    } catch {
      track("push_enable_fail");
      toast({ tone: "error", message: "Could not enable notifications. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration =
        (await navigator.serviceWorker.getRegistration("/"))
        || (await navigator.serviceWorker.getRegistration("/sw.js"));
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("off");
      track("push_disable");
      toast({ tone: "info", message: "Notifications off." });
    } catch {
      toast({ tone: "error", message: "Could not turn off notifications. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const Icon = busy ? Loader2 : status === "on" ? BellRing : status === "denied" ? BellOff : Bell;

  return (
    <section className="pref-panel">
      <div className="pref-panel-head">
        <h3>Browser notifications</h3>
        <p className="muted">
          Get a nudge in this browser when a check-in is due.
          {isIos ? " On iPhone, add Nura to your Home Screen first, then enable notifications." : ""}
        </p>
      </div>

      {status === "unsupported" || status === "missing_key" ? (
        <p className="muted">
          {status === "missing_key"
            ? "Push isn’t available in this environment yet. You can still use in-app check-ins."
            : "This browser doesn’t support push notifications. You can still use in-app check-ins."}
        </p>
      ) : status === "denied" ? (
        <div className="pref-notify-card is-blocked">
          <span className="pref-choice-icon" aria-hidden>
            <Icon />
          </span>
          <div className="pref-choice-copy">
            <b>Blocked in browser settings</b>
            <small>Allow notifications for usenura.app, then come back here to turn them on.</small>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`pref-notify-card ${status === "on" ? "is-on" : ""} ${busy ? "is-busy" : ""}`}
          disabled={busy || status === "checking"}
          onClick={() => (status === "on" ? disable() : enable())}
        >
          <span className="pref-choice-icon" aria-hidden>
            <Icon className={busy ? "spin" : undefined} />
          </span>
          <span className="pref-choice-copy">
            <b>{busy ? (status === "on" ? "Turning off…" : "Enabling…") : status === "on" ? "Notifications on" : "Show in the browser"}</b>
            <small>
              {busy
                ? "Check for a permission prompt from your browser."
                : status === "checking"
                  ? "Checking this browser…"
                  : status === "on"
                    ? "Tap to turn off for this browser"
                    : "Tap to allow nudges when a check-in is due"}
            </small>
          </span>
          <span className={`pref-switch-pill ${status === "on" ? "is-on" : ""}`} aria-hidden />
        </button>
      )}
    </section>
  );
}
