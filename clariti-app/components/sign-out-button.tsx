"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import { track } from "@/lib/analytics";

export function SignOutButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      track("sign_out");
      router.push("/");
      router.refresh();
    } catch {
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={className ?? "clariti-signout"} onClick={signOut} disabled={loading} aria-label="Sign out">
      {children ?? <LogOut />}
    </button>
  );
}
