"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { track } from "@/lib/analytics";
import {
  checkHealthAvailability,
  clearHealthSyncThrottle,
  requestHealthPermission,
  syncHealthData,
  type HealthAvailability,
} from "@/lib/health/native-health";
import { HEALTH_CONSENT_VERSION, HEALTH_METRICS, HEALTH_PLATFORM_LABELS, type HealthPlatform } from "@/lib/health/metrics";

/**
 * Agree → record consent → OS permission sheet → first sync. Consent is saved
 * before the sheet so nothing is ever read that the person hasn't agreed to here.
 */
export function HealthConsentActions({ platform: guessedPlatform }: { platform: HealthPlatform }) {
  const router = useRouter();
  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [step, setStep] = useState<"idle" | "saving" | "permission" | "syncing">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void checkHealthAvailability().then(setAvailability);
  }, []);

  const platform = availability && availability.state !== "web" ? availability.platform : guessedPlatform;
  const source = HEALTH_PLATFORM_LABELS[platform];

  async function connect() {
    setError(null);
    setStep("saving");
    const saved = await fetch("/api/health/connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, metrics: HEALTH_METRICS, consent_version: HEALTH_CONSENT_VERSION }),
    })
      .then((r) => r.ok)
      .catch(() => false);
    if (!saved) {
      setError("We couldn’t save that. Check your connection and try again.");
      setStep("idle");
      return;
    }

    setStep("permission");
    try {
      await requestHealthPermission();
    } catch {
      // Dismissing the sheet is not an error; the card explains how to allow types later.
    }

    setStep("syncing");
    clearHealthSyncThrottle();
    await syncHealthData({ lastSyncedAt: null, force: true }).catch(() => null);
    track("health_connected", { platform });
    router.replace("/me/connections");
    router.refresh();
  }

  if (!availability) return null;

  if (availability.state !== "ready") {
    const note =
      availability.state === "web"
        ? `Open the Nura app on your iPhone or Android phone to connect ${source}.`
        : availability.state === "update_app"
          ? `Update Nura from the ${platform === "apple_health" ? "App Store" : "Play Store"} to connect ${source}.`
          : platform === "health_connect"
            ? "Health Connect isn’t available on this phone. On Android 13 or earlier, install Health Connect from the Play Store first."
            : "Apple Health isn’t available on this device.";
    return <p className="auth-provider-error">{note}</p>;
  }

  const label =
    step === "saving" ? "Saving…" : step === "permission" ? `Waiting for ${source}…` : step === "syncing" ? "Syncing…" : "Agree and connect";

  return (
    <>
      <button type="button" className="primary-cta billing-lock-cta" onClick={connect} disabled={step !== "idle"}>
        <HeartPulse size={18} /> {label}
      </button>
      {error && (
        <p className="auth-provider-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
