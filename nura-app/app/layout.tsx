import type { Metadata } from "next";
import "./globals.css";
import "./nura-v2.css";
import "./dashboard-fix.css";
import "./dashboard-pages.css";
import "./product-design-overrides.css";
import "./ui-completion.css";
import "./ui-extra.css";
import "./mobile-landing.css";
import "./design-refresh.css";
import { CookieConsent } from "@/components/cookie-consent";

export const metadata: Metadata = {
  title: "Nura — Your AI health companion",
  description: "Nura listens, organises what matters, and follows up between the moments of care.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<CookieConsent /></body></html>;
}
