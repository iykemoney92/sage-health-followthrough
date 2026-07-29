"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

type Status = "checking" | "unsupported" | "denied" | "off" | "on";

async function checkStatus(): Promise<Status> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

export function PushNotificationsToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // Support/subscription state can only be read in the browser, so this
    // can't be known during the server render - deferring to an effect is
    // the correct approach here, not a something-you-forgot-to-do.
    void checkStatus().then(setStatus);
  }, []);

  async function enable() {
    setBusy(true);
    setNotice("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setStatus("on");
      setNotice("Notifications on - you'll get a test one now.");
    } catch {
      setNotice("Could not enable notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNotice("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
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
      setNotice("Notifications off.");
    } catch {
      setNotice("Could not turn off notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "unsupported") return null;

  return (
    <section>
      <h3>Browser notifications</h3>
      {status === "denied" ? (
        <p className="muted">Blocked in your browser settings. Allow notifications for this site to turn them back on.</p>
      ) : (
        <label className="toggle-row">
          Get notified in this browser
          <input
            type="checkbox"
            checked={status === "on"}
            disabled={busy || status === "checking"}
            onChange={(event) => (event.target.checked ? enable() : disable())}
          />
        </label>
      )}
      {notice && <p className="profile-save-note">{notice}</p>}
    </section>
  );
}
