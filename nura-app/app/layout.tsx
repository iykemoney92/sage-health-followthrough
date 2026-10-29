import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import "./nura-v2.css";
import "./dashboard-fix.css";
import "./dashboard-pages.css";
import "./product-design-overrides.css";
import "./ui-completion.css";
import "./ui-extra.css";
import "./mobile-landing.css";
import "./design-refresh.css";
import "./toast.css";
import { CookieConsent } from "@/components/cookie-consent";
import { GoogleAnalytics } from "@/components/google-analytics";
import { MetaPixel } from "@/components/meta-pixel";
import { GoogleAdsTag } from "@/components/google-ads-tag";
import { WebAnalytics } from "@/components/web-analytics";
import { NativeSignupConversion } from "@/components/native-signup-conversion";
import { NativeDeepLinks } from "@/components/native-deep-links";
import { NativeHealthSync } from "@/components/native-health-sync";
import { PostHogIdentity } from "@/components/posthog-identity";
import { QuoraPixel } from "@/components/quora-pixel";
import { ToastProvider } from "@/components/toast";
import { NURA_PRODUCT } from "@/lib/product/nura-story";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";

// Search results cut descriptions at ~160 characters; the longer
// NURA_PRODUCT.metaDescription still feeds the landing copy.
const description =
  "Nura is a health and wellbeing companion that checks in on you, by message or a gentle call, and keeps a simple Care plan so the next step doesn’t slip.";
const title = `Nura — ${NURA_PRODUCT.tagline}`;

export const metadata: Metadata = {
  // Relative URLs below (canonicals, the generated share image) resolve against
  // this; without it Next falls back to localhost.
  metadataBase: new URL(appUrl),
  title: { default: title, template: "%s · Nura" },
  description,
  applicationName: "Nura",
  openGraph: {
    type: "website",
    siteName: "Nura",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  // iPhone Smart App Banner (Safari only; does nothing inside the app shell).
  itunes: { appId: "6804203569" },
  icons: {
    icon: [
      { url: "/brand/nura-app-icon.png", type: "image/png", sizes: "512x512" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// viewport-fit=cover is required for env(safe-area-inset-*) to resolve to
// anything but 0 — without it, the Capacitor iOS shell's status bar/notch
// overlaps fixed top bars, and the app's existing bottom safe-area padding
// (.mobile-nav, .final-intake-composer) is silently a no-op too.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body className={dmSans.className}>
        <ToastProvider>
          {children}
          <NativeDeepLinks />
          <NativeHealthSync />
          <CookieConsent />
          <GoogleAnalytics />
          <QuoraPixel />
          <MetaPixel />
          <GoogleAdsTag />
          <WebAnalytics />
          <NativeSignupConversion />
          <PostHogIdentity />
        </ToastProvider>
      </body>
    </html>
  );
}
