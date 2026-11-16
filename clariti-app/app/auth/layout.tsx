import type { Metadata } from "next";
import { PrivateArea } from "@/components/private-area";

// Sign-in plumbing (reset password, confirm). robots.ts already disallows /auth/;
// this covers any copy of these URLs a crawler reaches through a link.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PrivateArea>{children}</PrivateArea>;
}
