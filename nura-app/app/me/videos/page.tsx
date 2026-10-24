import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { NuraSocialLinks, VideoLibrary } from "@/components/video-library";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { NURA_SOCIALS } from "@/lib/nura-videos";

/** The walkthrough plus short how-tos, and links out to Nura's own social accounts. */
export default async function VideosPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me/videos");

  const supabase = await getSupabaseSessionClient();
  const { data: profile } = await supabase.from("nura_profiles").select("display_name").eq("id", user.id).maybeSingle();
  const displayName =
    (profile?.display_name as string | null) || (user.user_metadata?.display_name as string | undefined) || user.email || "You";

  return (
    <NuraShell userName={displayName} userAvatarUrl={getUserAvatarUrl(user)}>
      <div className="dashboard-page settings-detail-page me-settings-detail me-section-videos">
        <Link href="/me" className="back-link">
          <ArrowLeft /> Me
        </Link>
        <header className="settings-detail-head">
          <span className="settings-hero-icon">
            <Clapperboard />
          </span>
          <div>
            <h1>Videos &amp; socials</h1>
            <p>Short how-tos you can watch any time, and where to follow Nura.</p>
          </div>
        </header>

        <section className="me-settings-group" aria-label="Videos">
          <div className="me-section-label">Videos</div>
          <VideoLibrary />
        </section>

        {NURA_SOCIALS.length > 0 && (
          <section className="me-settings-group" aria-label="Follow Nura">
            <div className="me-section-label">Follow Nura</div>
            <p className="muted video-socials-note">New clips and tips land there first.</p>
            <NuraSocialLinks />
          </section>
        )}
      </div>
    </NuraShell>
  );
}
