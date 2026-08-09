"use client";

import { Suspense, useEffect, useState } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { ANALYTICS_CONSENT_EVENT, getAnalyticsConsent, getGaMeasurementId } from "@/lib/analytics-consent";

function sendPageView(measurementId: string, url: string) {
  if (typeof window.gtag !== "function") return;
  window.gtag("config", measurementId, { page_path: url });
}

function GoogleAnalyticsTracker({ measurementId, ready }: { measurementId: string; ready: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!ready || !pathname) return;
    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    sendPageView(measurementId, url);
  }, [measurementId, pathname, ready, searchParams]);

  return null;
}

export function GoogleAnalytics() {
  const measurementId = getGaMeasurementId();
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(getAnalyticsConsent() === "granted");
    sync();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, sync);
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, sync);
  }, []);

  if (!measurementId || !allowed) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="clariti-google-analytics" strategy="afterInteractive" onReady={() => setReady(true)}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', { send_page_view: false });
        `}
      </Script>
      <Suspense fallback={null}>
        <GoogleAnalyticsTracker measurementId={measurementId} ready={ready} />
      </Suspense>
    </>
  );
}
