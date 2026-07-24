import type { Metadata } from "next";
import "./globals.css";
import "./nura-entry.css";

export const metadata: Metadata = {
  title: "Nura",
  description: "Personal AI health companion for living plans and proactive follow-through.",
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
