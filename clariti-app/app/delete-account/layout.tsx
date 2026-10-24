import { PrivateArea } from "@/components/private-area";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PrivateArea>{children}</PrivateArea>;
}
