"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { track } from "@/lib/analytics";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

export function SignOutButton({
  className = "secondary-cta",
  source = "unknown",
}: {
  className?: string;
  source?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    track("logout", { source });
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button className={className} type="button" onClick={signOut} disabled={loading}>
      <LogOut /> {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
