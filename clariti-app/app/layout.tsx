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
import { KeyboardInset } from "@/components/keyboard-inset";
import { NativeBackButton } from "@/components/native-back-button";
import { NativeDeepLinks } from "@/components/native-deep-links";
import { QuoraPixel } from "@/components/quora-pixel";

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

// Ties Clariti to Zapx Labs and its store listing so search and AI assistants
// resolve "Clariti" to this app rather than a namesake.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${appUrl}/#app`,
  name: "Clariti",
  alternateName: "Clariti by Zapx Labs",
  description,
  url: appUrl,
  applicationCategory: "HealthApplication",
  operatingSystem: "Web, Android",
  publisher: {
    "@type": "Organization",
    "@id": "https://zapxlabs.com/#organization",
    name: "Zapx Labs",
    url: "https://zapxlabs.com",
  },
  sameAs: [
    "https://zapxlabs.com/products/clariti",
    "https://play.google.com/store/apps/details?id=app.useclariti.mobile",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body data-ui-version="mobile-nav-v2">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
        <NativeDeepLinks />
        <KeyboardInset />
        <NativeBackButton />
        <AppUpdateNotice />
        <CookieConsent />
        <GoogleAnalytics />
        <QuoraPixel />
      </body>
    </html>
  );
}
