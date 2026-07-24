import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nura — Your AI health companion",
  description: "Nura listens, organises what matters, and follows up between the moments of care.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
