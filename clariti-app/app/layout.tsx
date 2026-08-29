import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./followthrough.css";
import "./clariti-entry.css";
import "./mobile.css";
import "./sidebar.css";
import "./modal.css";
import "./canvas.css";
import "./auth.css";
import "./native.css";
import { AppUpdateNotice } from "@/components/app-update-notice";
import { CookieConsent } from "@/components/cookie-consent";
import { GoogleAnalytics } from "@/components/google-analytics";
import { NativeDeepLinks } from "@/components/native-deep-links";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://useclariti.app";

const description =
  "Clariti reads your medical bills, lab results, scans and insurance letters, explains them in plain language, and helps you work out what to ask next.";

export const metadata: Metadata = {
  // Anything relative in openGraph — the share image, once there is one —
  // resolves against this. Without it Next falls back to localhost and every
  // shared link carries a dead preview.
  metadataBase: new URL(appUrl),
  title: {
    default: "Clariti — understand your health documents",
    template: "%s · Clariti",
  },
  description,
  applicationName: "Clariti",
  openGraph: {
    type: "website",
    siteName: "Clariti",
    url: appUrl,
    title: "Clariti — understand your health documents",
    description,
  },
  // Deliberately no `icons` key: app/icon.tsx and app/apple-icon.tsx already emit
  // the <link> tags, and Next only falls back to those files when this object
  // does not set icons at all — declaring them here replaces them rather than
  // adding to them, dropping the sizes and the content hash that stops iOS
  // serving a stale home-screen icon after a redeploy.
};

// viewport-fit=cover is what makes every env(safe-area-inset-*) resolve to
// anything but 0. Without it the Capacitor iOS shell draws the app under the
// notch and the home indicator, and the bottom padding the mobile nav already
// asks for is silently worth nothing.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body data-ui-version="mobile-nav-v2">
        {children}
        <NativeDeepLinks />
        <AppUpdateNotice />
        <CookieConsent />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
