"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { track } from "@/lib/analytics";
import {
  checkHealthAvailability,
  clearHealthSyncThrottle,
  healthConnectGrantedCount,
  nativeHealthPlatform,
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

function formatSynced(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

type Connections = { connection: Connection | null; others: HealthPlatform[] };

/**
 * On a phone, only that phone's own connection counts: someone who connected Apple Health
 * on their iPhone still has to connect Health Connect on their Android phone. The website
 * shows whichever synced last.
 */
async function loadConnections(): Promise<Connections> {
  const platform = nativeHealthPlatform();
  const url = platform ? `/api/health/connection?platform=${platform}` : "/api/health/connection";
  const response = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!response?.ok) return { connection: null, others: [] };
  const body = (await response.json().catch(() => null)) as {
    connection: Connection | null;
    other_platforms?: HealthPlatform[];
  } | null;
  return { connection: body?.connection ?? null, others: body?.other_platforms ?? [] };
}

export function HealthConnectionCard() {
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [others, setOthers] = useState<HealthPlatform[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Android only: how many types the person allowed, to explain an empty sync.
  const [allowed, setAllowed] = useState<number | null>(null);

  const refresh = useCallback(
    () =>
      loadConnections().then((next) => {
        setConnection(next.connection);
        setOthers(next.others);
        setLoaded(true);
      }),
    [],
  );

  useEffect(() => {
    void checkHealthAvailability().then(setAvailability);
    void refresh();
    void healthConnectGrantedCount().then(setAllowed);
  }, [refresh]);

  if (!availability || !loaded) return null;

  const platform = connection?.platform ?? (availability.state === "web" ? null : availability.platform);
  const label = platform ? HEALTH_PLATFORM_LABELS[platform] : "Apple Health or Health Connect";
  const pluginReady = availability.state === "ready";
  const otherLabels = others.map((p) => HEALTH_PLATFORM_LABELS[p]).join(" and ");

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
    // A phone disconnects only itself; the website has no phone of its own, so it disconnects all.
    const devicePlatform = nativeHealthPlatform();
    const what = devicePlatform || others.length === 0 ? label : `${label} and ${otherLabels}`;
    if (!window.confirm(`Disconnect ${what}? Nura will delete everything it has stored from it.`)) return;
    setBusy("disconnect");
    setMessage(null);
    const url = devicePlatform ? `/api/health/connection?platform=${devicePlatform}` : "/api/health/connection";
    const ok = await fetch(url, { method: "DELETE" })
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) {
      track("health_disconnected", { platform: connection?.platform ?? "unknown" });
      clearHealthSyncThrottle();
      setConnection(null);
      if (!devicePlatform) setOthers([]);
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
        connection.platform === "apple_health" ? (
          <>No data from Apple Health yet. If you turned some types off, you can allow them in the Health app → your profile → Apps → Nura.</>
        ) : allowed === 0 ? (
          <>Nura isn’t allowed to read anything from Health Connect yet. Tap Manage permissions and turn on Steps and Sleep, then Sync now.</>
        ) : (
          <>
            No sleep or steps in Health Connect yet. It only holds what other apps save to it: if you use Samsung Health, Google
            Fit or a watch app, turn on its Health Connect sync, then tap Sync now.
          </>
        )
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
          {others.length > 0 && (
            <p className="muted">
              {otherLabels} is also connected from your other phone.
              {connection && !nativeHealthPlatform() ? " Disconnecting here removes both." : ""}
            </p>
          )}
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
