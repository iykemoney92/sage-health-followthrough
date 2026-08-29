"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { ArrowUpCircle, RefreshCw } from "lucide-react";

/** Quiet enough to disappear in aggregate, frequent enough to catch a deploy. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * The App Store listing for app.useclariti.mobile, once there is one.
 *
 * Deliberately has no fallback id: Clariti has not been through review yet, and
 * guessing an id would send people to a "not available in your region" page,
 * which is worse than the plain notice they get while this is unset.
 */
const APP_STORE_URL = process.env.NEXT_PUBLIC_IOS_APP_STORE_URL?.trim() ?? "";

type VersionPayload = { build: string; minNativeBuild: number };

async function fetchVersion(signal: AbortSignal): Promise<VersionPayload | null> {
  try {
    const response = await fetch("/api/app-version", { cache: "no-store", signal });
    if (!response.ok) return null;
    return (await response.json()) as VersionPayload;
  } catch {
    // Offline, or the app was backgrounded mid-request. Silence is right here: a
    // failed version check is not something to put in front of anyone.
    return null;
  }
}

/**
 * Tells an already-open session when it has fallen behind what is deployed.
 *
 * Because the shell loads the live web app rather than a bundled copy, shipping
 * reaches anyone who opens the app fresh — but a session that has been sitting
 * open keeps running the JavaScript it loaded hours ago. This closes that window
 * without ever reloading underneath someone: it offers, they choose.
 *
 * The native shell is the one part a deploy genuinely cannot update, so a build
 * older than the server's floor is pointed at the App Store instead.
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

    // The first response defines "what this session is running". Comparing
    // against a build-time constant instead would misfire on every preview
    // deployment, where the constant and the server never agree.
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

    // Mounted in the root layout rather than inside ClaritiShell, because the
    // workspace — the surface most likely to sit open for hours — does not render
    // the shell. That puts this on the public pages too, so a hidden tab is
    // skipped: it has nothing to act on until someone looks at it again.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check(controller.signal);
    }, POLL_INTERVAL_MS);
    // Returning to a backgrounded app is the likeliest moment to be stale, and
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
        <span>This version of Clariti is out of date.</span>
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
      <span>There’s a newer version of Clariti.</span>
      <button type="button" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}
