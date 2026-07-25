import type { Metadata } from "next";
import "./globals.css";
import "./followthrough.css";
import "./clariti-entry.css";
import "./mobile.css";
import "./sidebar.css";
import "./modal.css";
import "./canvas.css";
import "./auth.css";

export const metadata: Metadata = {
  title: "Clariti",
  description: "Consumer health document copilot — mobile-first prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body data-ui-version="mobile-nav-v2">{children}</body>
    </html>
  );
}
