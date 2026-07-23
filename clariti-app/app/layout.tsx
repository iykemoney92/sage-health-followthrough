import type { Metadata } from "next";
import "./globals.css";
import "./followthrough.css";
import "./clariti-entry.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "Clariti",
  description: "Consumer health document copilot.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
