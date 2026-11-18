import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start your free trial",
  robots: { index: false, follow: false },
};

export default function StartTrialLayout({ children }: { children: React.ReactNode }) {
  return children;
}
