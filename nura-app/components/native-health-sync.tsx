"use client";

import { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { isHealthPluginPresent, nativeHealthPlatform, syncHealthData } from "@/lib/health/native-health";

type ConnectionResponse = { ok: boolean; connection: { last_synced_at: string | null } | null };

async function syncIfConnected() {
  // Only this phone's own connection: an Apple Health consent says nothing about Health Connect.
  const response = await fetch(`/api/health/connection?platform=${nativeHealthPlatform()}`, { cache: "no-store" }).catch(
    () => null,
  );
  if (!response?.ok) return; // signed out, or no consent yet
  const body = (await response.json().catch(() => null)) as ConnectionResponse | null;
  if (!body?.connection) return;
  await syncHealthData({ lastSyncedAt: body.connection.last_synced_at });
}

/**
 * Syncs health data when the app opens and whenever it comes back to the foreground.
 * There is no background sync, so this is the only way new data arrives; the
 * six-hour throttle in syncHealthData keeps it from running on every tab switch.
 * Inert on the web and in binaries without the health plugin.
 */
export function NativeHealthSync() {
  useEffect(() => {
    if (!isHealthPluginPresent()) return;

    let removeListener: (() => void) | undefined;
    void syncIfConnected().catch(() => {});
    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void syncIfConnected().catch(() => {});
    }).then((handle) => {
      removeListener = () => void handle.remove();
    });

    return () => removeListener?.();
  }, []);

  return null;
}
