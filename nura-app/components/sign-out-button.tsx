"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

export function SignOutButton({ className = "secondary-cta" }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button className={className} type="button" onClick={signOut} disabled={loading}>
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
