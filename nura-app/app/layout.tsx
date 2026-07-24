import type { Metadata } from "next";
import "./globals.css";
import "./nura-v2.css";
import "./dashboard-fix.css";
import "./dashboard-pages.css";

export const metadata: Metadata = {
  title: "Nura — Your AI health companion",
  description: "Nura listens, organises what matters, and follows up between the moments of care.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}