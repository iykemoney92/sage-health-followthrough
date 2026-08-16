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
import { NativeDeepLinks } from "@/components/native-deep-links";
import { ToastProvider } from "@/components/toast";
import { NURA_PRODUCT } from "@/lib/product/nura-story";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: `Nura — ${NURA_PRODUCT.tagline}`,
  description: NURA_PRODUCT.metaDescription,
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
          <CookieConsent />
          <GoogleAnalytics />
        </ToastProvider>
      </body>
    </html>
  );
}
