import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sage — Health follow-through",
  description: "Turn health advice into a plan you can actually follow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
