import type { Metadata } from "next";
import { PrivateArea } from "@/components/private-area";

// Plan and checkout screens answer 200 to a signed-out crawler, but there is
// nothing on them to rank; without a canonical they read as duplicates of "/".
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PrivateArea>{children}</PrivateArea>;
}
