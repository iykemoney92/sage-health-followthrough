"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
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

// Only true inside the Capacitor-wrapped iOS/Android app (nura-mobile) — false
// for every browser, including mobile Safari/Chrome, where the web-push path
// below applies instead.
const isNative = Capacitor.isNativePlatform();
const nativePlatform = Capacitor.getPlatform();
const NATIVE_TOKEN_STORAGE_KEY = "nura_native_push_token";

async function checkNativeStatus(): Promise<Status> {
  if (nativePlatform !== "ios" && nativePlatform !== "android") return "unsupported";
  const result = await PushNotifications.checkPermissions().catch(() => null);
  if (!result) return "unsupported";
  if (result.receive === "denied") return "denied";
  if (result.receive === "granted") return "on";
  return "off";
}

async function checkWebStatus(): Promise<Status> {
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

function checkStatus(): Promise<Status> {
  return isNative ? checkNativeStatus() : checkWebStatus();
}

/** Resolves once the OS hands back a device token (or rejects on registrationError). */
async function registerNativeDevice(): Promise<string> {
  return withTimeout(
    new Promise<string>((resolve, reject) => {
      Promise.all([
        PushNotifications.addListener("registration", (token) => {
          resolve(token.value);
        }),
        PushNotifications.addListener("registrationError", (err) => {
          reject(new Error(err.error || "registration failed"));
        }),
      ]).then(([regHandle, errHandle]) => {
        void PushNotifications.register().catch((error) => {
          regHandle.remove();
          errHandle.remove();
          reject(error instanceof Error ? error : new Error("register failed"));
        });
      });
    }),
    15000,
    "Device registration took too long.",
  );
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
    // The "add to Home Screen first" hint only applies to the Safari PWA push
    // path — the native app doesn't need it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsIos(!isNative && /iPhone|iPad|iPod/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!autoRequest || autoRequestedRef.current || status !== "off") return;
    autoRequestedRef.current = true;
    void enable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequest, status]);

  async function enableNative() {
    const permStatus = await PushNotifications.checkPermissions();
    let receive = permStatus.receive;
    if (receive === "prompt" || receive === "prompt-with-rationale") {
      const requested = await PushNotifications.requestPermissions();
      receive = requested.receive;
    }
    track("push_permission", { result: receive });
    if (receive !== "granted") {
      setStatus(receive === "denied" ? "denied" : "off");
      toast({
        tone: "info",
        message: receive === "denied" ? "Notifications are blocked in Settings." : "Permission wasn’t granted — you can try again later.",
      });
      return;
    }

    const token = await registerNativeDevice();
    window.localStorage?.setItem(NATIVE_TOKEN_STORAGE_KEY, token);

    const res = await fetch("/api/push/register-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: nativePlatform, token }),
    });
    const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; testSent?: number } | null;
    if (!res.ok || !payload?.ok) {
      throw new Error(payload?.error || "register failed");
    }

    setStatus("on");
    track("push_enable_success", { test_sent: (payload.testSent ?? 0) > 0, native: true });
    toast({
      title: "Notifications on",
      message: (payload.testSent ?? 0) > 0 ? "You’ll get a test one now." : "Saved — check-ins can reach this device.",
    });
  }

  async function enableWeb() {
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
  }

  async function enable() {
    setBusy(true);
    track("push_enable_click");
    try {
      if (isNative) {
        await enableNative();
      } else {
        await enableWeb();
      }
    } catch {
      track("push_enable_fail");
      toast({ tone: "error", message: "Could not enable notifications. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function disableNative() {
    const token = window.localStorage?.getItem(NATIVE_TOKEN_STORAGE_KEY);
    if (token) {
      await fetch("/api/push/unregister-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }).catch(() => null);
      window.localStorage?.removeItem(NATIVE_TOKEN_STORAGE_KEY);
    }
    // OS-level permission itself can only be revoked from system Settings — this
    // just stops the backend from sending to the stored token.
  }

  async function disableWeb() {
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
  }

  async function disable() {
    setBusy(true);
    try {
      if (isNative) {
        await disableNative();
      } else {
        await disableWeb();
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
        <h3>{isNative ? "Notifications" : "Browser notifications"}</h3>
        <p className="muted">
          {isNative ? "Get a nudge on this device when a check-in is due." : "Get a nudge in this browser when a check-in is due."}
          {isIos ? " On iPhone, add Nura to your Home Screen first, then enable notifications." : ""}
        </p>
      </div>

      {status === "unsupported" || status === "missing_key" ? (
        <p className="muted">
          {status === "missing_key"
            ? "Push isn’t available in this environment yet. You can still use in-app check-ins."
            : "This app doesn’t support push notifications yet. You can still use in-app check-ins."}
        </p>
      ) : status === "denied" ? (
        <div className="pref-notify-card is-blocked">
          <span className="pref-choice-icon" aria-hidden>
            <Icon />
          </span>
          <div className="pref-choice-copy">
            <b>Blocked in {isNative ? "system settings" : "browser settings"}</b>
            <small>
              {isNative
                ? "Allow notifications for Nura in Settings, then come back here to turn them on."
                : "Allow notifications for usenura.app, then come back here to turn them on."}
            </small>
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
            <b>{busy ? (status === "on" ? "Turning off…" : "Enabling…") : status === "on" ? "Notifications on" : isNative ? "Enable notifications" : "Show in the browser"}</b>
            <small>
              {busy
                ? `Check for a permission prompt from ${isNative ? "your device" : "your browser"}.`
                : status === "checking"
                  ? "Checking…"
                  : status === "on"
                    ? `Tap to turn off for this ${isNative ? "device" : "browser"}`
                    : "Tap to allow nudges when a check-in is due"}
            </small>
          </span>
          <span className={`pref-switch-pill ${status === "on" ? "is-on" : ""}`} aria-hidden />
        </button>
      )}
    </section>
  );
}
