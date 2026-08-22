"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { RefreshCw, ArrowUpCircle } from "lucide-react";

/** Quiet enough to be invisible in aggregate, frequent enough to catch a deploy. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * The App Store Connect record for app.usenura.mobile. Overridable so a build
 * pointed at a different listing doesn't need a code change; falls back to the
 * real ID rather than a placeholder, which would send people to a
 * "not available" page.
 */
const APP_STORE_URL =
  process.env.NEXT_PUBLIC_IOS_APP_STORE_URL ?? "https://apps.apple.com/app/id6804203569";

type VersionPayload = { build: string; minNativeBuild: number };

async function fetchVersion(signal: AbortSignal): Promise<VersionPayload | null> {
  try {
    const response = await fetch("/api/app-version", { cache: "no-store", signal });
    if (!response.ok) return null;
    return (await response.json()) as VersionPayload;
  } catch {
    // Offline, or the app was backgrounded mid-request. Silence is correct here:
    // a failed version check is not something to put in front of someone.
    return null;
  }
}

/**
 * Tells an already-open session when it has fallen behind what's deployed.
 *
 * Because the shell loads the live web app rather than a bundled copy, shipping
 * is instant for anyone who opens the app fresh — but a session that has been
 * sitting open keeps running the JavaScript it loaded hours ago. This closes
 * that window without ever reloading underneath someone: it offers, they choose.
 *
 * The native shell is the one part a deploy genuinely can't update, so a build
 * older than the server's floor gets pointed at the App Store instead.
 */
export function AppUpdateNotice() {
  const [webStale, setWebStale] = useState(false);
  const [nativeStale, setNativeStale] = useState(false);
  const loadedBuild = useRef<string | null>(null);
  const nativeBuild = useRef<number | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    void CapacitorApp.getInfo()
      .then((info) => {
        if (active) nativeBuild.current = Number.parseInt(info.build, 10);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const check = useCallback(async (signal: AbortSignal) => {
    const payload = await fetchVersion(signal);
    if (!payload || signal.aborted) return;

    // First response defines "what this session is running". Comparing against a
    // build-time constant instead would misfire on every preview deployment.
    if (loadedBuild.current === null) {
      loadedBuild.current = payload.build;
    } else if (payload.build !== loadedBuild.current) {
      setWebStale(true);
    }

    const build = nativeBuild.current;
    if (build !== null && Number.isFinite(build)) {
      setNativeStale(build < payload.minNativeBuild);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void check(controller.signal);

    const timer = window.setInterval(() => void check(controller.signal), POLL_INTERVAL_MS);
    // Coming back to a backgrounded app is the likeliest moment to be stale, and
    // the cheapest moment to find out.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(controller.signal);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  if (nativeStale) {
    return (
      <div className="app-update-notice app-update-required" role="status">
        <ArrowUpCircle aria-hidden />
        <span>A newer version of Nura is available.</span>
        {APP_STORE_URL && (
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer">
            Update
          </a>
        )}
      </div>
    );
  }

  if (!webStale) return null;

  return (
    <div className="app-update-notice" role="status">
      <RefreshCw aria-hidden />
      <span>Nura just updated.</span>
      <button type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}
