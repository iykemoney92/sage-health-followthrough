"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps nura_profiles.timezone in sync with the browser IANA zone so
 * check-ins / calls land at the user's local wall-clock time.
 */
export function TimezoneSync() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    let timezone = "UTC";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return;
    }

    void fetch("/api/profile/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    }).catch(() => null);
  }, []);

  return null;
}
