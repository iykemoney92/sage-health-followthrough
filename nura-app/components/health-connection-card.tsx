"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { track } from "@/lib/analytics";
import {
  checkHealthAvailability,
  clearHealthSyncThrottle,
  openHealthSettings,
  syncHealthData,
  type HealthAvailability,
} from "@/lib/health/native-health";
import { HEALTH_PLATFORM_LABELS, type HealthPlatform } from "@/lib/health/metrics";

type Connection = {
  platform: HealthPlatform;
  last_synced_at: string | null;
  last_sync_status: "ok" | "no_data" | "error" | null;
};

/**
 * Until the health-enabled binaries are approved, only an install that already has the
 * plugin sees the real card (that is what App Review gets). Everyone else keeps the
 * "coming soon" note, unless this flag is switched on after release.
 */
const ANNOUNCED = process.env.NEXT_PUBLIC_HEALTH_CONNECT_ENABLED === "true";

function formatSynced(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function loadConnection(): Promise<Connection | null> {
  const response = await fetch("/api/health/connection", { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json().catch(() => null)) as { connection: Connection | null } | null;
  return body?.connection ?? null;
}

function ComingSoon() {
  return (
    <section>
      <h3>
        Future health connections <span className="preview-badge">Coming soon</span>
      </h3>
      <p className="muted">
        Apple Health, wearables and clinic record links are on the roadmap. Nothing here shares data until you connect it.
      </p>
    </section>
  );
}

export function HealthConnectionCard() {
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      loadConnection().then((next) => {
        setConnection(next);
        setLoaded(true);
      }),
    [],
  );

  useEffect(() => {
    void checkHealthAvailability().then(setAvailability);
    void loadConnection().then((next) => {
      setConnection(next);
      setLoaded(true);
    });
  }, []);

  if (!availability || !loaded) return null;

  const platform = connection?.platform ?? (availability.state === "web" ? null : availability.platform);
  const label = platform ? HEALTH_PLATFORM_LABELS[platform] : "Apple Health or Health Connect";
  const pluginReady = availability.state === "ready";

  if (!connection && !pluginReady && !ANNOUNCED) return <ComingSoon />;

  async function syncNow() {
    if (!connection) return;
    setBusy("sync");
    setMessage(null);
    clearHealthSyncThrottle();
    const result = await syncHealthData({ lastSyncedAt: connection.last_synced_at, force: true });
    setMessage(result.ok ? null : "Couldn’t sync just now. Try again in a moment.");
    await refresh();
    setBusy(null);
  }

  async function disconnect() {
    if (!window.confirm(`Disconnect ${label}? Nura will delete everything it has stored from it.`)) return;
    setBusy("disconnect");
    setMessage(null);
    const ok = await fetch("/api/health/connection", { method: "DELETE" })
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) {
      track("health_disconnected", { platform: connection?.platform ?? "unknown" });
      clearHealthSyncThrottle();
      setConnection(null);
      setMessage(
        connection?.platform === "apple_health"
          ? "Disconnected and deleted. To also remove Nura’s access, open the Health app → your profile → Apps → Nura."
          : "Disconnected and deleted.",
      );
    } else {
      setMessage("Couldn’t disconnect. Check your connection and try again.");
    }
    setBusy(null);
  }

  let status: React.ReactNode;
  let body: React.ReactNode;
  let actions: React.ReactNode;

  if (connection) {
    status = <span className="connection-status-pill is-connected">Connected</span>;
    body =
      connection.last_sync_status === "no_data" ? (
        <>
          No data from {label} yet. If you turned some types off, you can allow them in{" "}
          {connection.platform === "apple_health" ? "the Health app → your profile → Apps → Nura" : "Health Connect settings"}.
        </>
      ) : connection.last_synced_at ? (
        <>Last synced {formatSynced(connection.last_synced_at)}. Nura reads daily summaries only when you open the app.</>
      ) : (
        <>Connected. Your first sync runs the next time Nura opens.</>
      );
    actions = (
      <>
        {pluginReady && (
          <button type="button" className="secondary-cta" onClick={syncNow} disabled={busy !== null}>
            {busy === "sync" ? "Syncing…" : "Sync now"}
          </button>
        )}
        {pluginReady && connection.platform === "health_connect" && (
          <button type="button" className="secondary-cta" onClick={() => void openHealthSettings()}>
            Manage permissions
          </button>
        )}
        <button type="button" className="ghost-danger-btn" onClick={disconnect} disabled={busy !== null}>
          {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
        </button>
      </>
    );
  } else if (pluginReady) {
    status = <span className="connection-status-pill">Not connected</span>;
    body = <>Let Nura read steps, sleep, resting heart rate, weight and blood pressure to make check-ins more personal.</>;
    actions = (
      <Link href="/me/health" className="primary-cta">
        Connect {label}
      </Link>
    );
  } else if (availability.state === "update_app") {
    status = <span className="connection-status-pill is-pending">Update needed</span>;
    body = <>Update Nura from the {availability.platform === "apple_health" ? "App Store" : "Play Store"} to connect {label}.</>;
  } else if (availability.state === "unavailable") {
    status = <span className="connection-status-pill is-pending">Unavailable</span>;
    body =
      availability.platform === "health_connect" ? (
        <>Health Connect isn’t available on this phone. On Android 13 or earlier, install Health Connect from the Play Store.</>
      ) : (
        <>Apple Health isn’t available on this device.</>
      );
  } else {
    status = <span className="connection-status-pill">In the app</span>;
    body = <>Connect Apple Health or Health Connect from the Nura app on your iPhone or Android phone.</>;
  }

  return (
    <section className="connection-app-card">
      <div className="connection-app-head">
        <span className="connection-app-icon" aria-hidden>
          <HeartPulse />
        </span>
        <div>
          <div className="connection-app-title-row">
            <h3>{label}</h3>
            {status}
          </div>
          <p className="muted">{body}</p>
          <p className="muted">Never shown to your Care circle, in notifications or on WhatsApp.</p>
          {message && (
            <p className="connection-channel-note" role="status">
              {message}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="connection-app-actions">{actions}</div>}
    </section>
  );
}
