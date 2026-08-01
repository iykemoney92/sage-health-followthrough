import Link from "next/link";
import { CalendarDays, CheckCircle2, MessageCircle } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

type Note = { icon: "check-in" | "calendar" | "done"; title: string; copy: string; at: string };

function relativeLabel(dateString: string) {
  const target = new Date(dateString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return `Today, ${target.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`;
  if (diffDays === 1) return `Tomorrow, ${target.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`;
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1) return `In ${diffDays} days`;
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
  return target.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const ICONS = { "check-in": MessageCircle, calendar: CalendarDays, done: CheckCircle2 };

export default async function NotificationsPage() {
  const user = await getSessionUser();
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || "You";
  const avatarUrl = getUserAvatarUrl(user);
  const supabase = await getSupabaseSessionClient();

  const [{ data: upcoming }, { data: completed }, { data: observations }] = await Promise.all([
    user
      ? supabase.from("nura_check_ins").select("id, scheduled_for, nura_plans(title)").eq("owner_id", user.id).is("completed_at", null).order("scheduled_for", { ascending: true }).limit(3)
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("nura_check_ins").select("id, completed_at, nura_plans(title)").eq("owner_id", user.id).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(3)
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("nura_observations").select("id, label, value, recorded_at, nura_plans(title)").eq("owner_id", user.id).order("recorded_at", { ascending: false }).limit(3)
      : Promise.resolve({ data: null }),
  ]);

  const notes: Note[] = [
    ...(upcoming ?? []).map((c) => ({
      icon: "check-in" as const,
      title: "Check-in coming up",
      copy: `Nura will check in about your ${(c.nura_plans as unknown as { title: string } | null)?.title ?? "Care plan"}.`,
      at: c.scheduled_for as string,
    })),
    ...(completed ?? []).map((c) => ({
      icon: "done" as const,
      title: "Check-in completed",
      copy: `Your ${(c.nura_plans as unknown as { title: string } | null)?.title ?? "Care plan"} check-in was saved.`,
      at: c.completed_at as string,
    })),
    ...(observations ?? []).map((o) => ({
      icon: "calendar" as const,
      title: "New update logged",
      copy: `${(o.nura_plans as unknown as { title: string } | null)?.title ?? "A Care plan"}: ${o.label === "mood" ? `feeling ${o.value}` : o.value}`,
      at: o.recorded_at as string,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page notifications-page">
        <div className="library-heading">
          <div>
            <span className="auth-kicker">NOTIFICATIONS</span>
            <h1>What Nura is bringing back to you.</h1>
            <p>Follow-ups, reminders and useful context—kept intentionally light.</p>
          </div>
        </div>
        <section className="notification-list">
          {notes.length > 0 ? (
            notes.map((note, index) => {
              const Icon = ICONS[note.icon];
              return (
                <article key={`${note.title}-${index}`}>
                  <span><Icon /></span>
                  <div><h3>{note.title}</h3><p>{note.copy}</p><small>{relativeLabel(note.at)}</small></div>
                </article>
              );
            })
          ) : (
            <p className="checkin-copy">Nothing yet — activity from your Care plans will show up here.</p>
          )}
        </section>
        <Link href="/me/preferences" className="text-arrow">Manage notification preferences</Link>
      </div>
    </NuraShell>
  );
}
