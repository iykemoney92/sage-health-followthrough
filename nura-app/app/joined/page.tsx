"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NuraLogo } from "@/components/nura-logo";
import { track } from "@/lib/analytics";
import { safeNextPath } from "@/lib/auth/safe-path";
import { googleAdsTrack } from "@/lib/google-ads-tag";
import { metaTrack } from "@/lib/meta-pixel";
import { pinterestTrack } from "@/lib/pinterest-tag";
import { quoraTrack } from "@/lib/quora-pixel";
import "../auth.css";

/**
 * A new account made with Google or Apple passes here once on its way in (app/auth/callback), so it
 * counts as a sign-up the way the email form's does (app/signup). Until 7 Nov 2026 only email sign-ups
 * were counted, so ads never saw a provider sign-up.
 *
 * This is a public page with nothing about the person on it (lib/quora-pixel.ts PUBLIC_PATHS), and the
 * same limits hold: the pixels and the Google Ads tag send only if the visitor pressed Accept on the
 * cookie notice, and nothing loads inside the app shells.
 */
function Joined() {
  const router = useRouter();
  const params = useSearchParams();
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track("signup_complete", { method: "provider", needs_confirmation: false });
    quoraTrack("CompleteRegistration");
    metaTrack("CompleteRegistration");
    pinterestTrack("signup");
    googleAdsTrack("SignUp");
    // Middleware takes /login on to /onboarding or /today. A moment first, so an accepted tag's request leaves.
    const next = safeNextPath(params.get("next"), "/login");
    const t = window.setTimeout(() => router.replace(next), 600);
    return () => window.clearTimeout(t);
  }, [params, router]);

  return (
    <main className="auth-v2">
      <section className="auth-panel">
        <NuraLogo tagline={false} />
        <p>Setting up your Nura…</p>
      </section>
    </main>
  );
}

export default function JoinedPage() {
  return (
    <Suspense fallback={null}>
      <Joined />
    </Suspense>
  );
}
