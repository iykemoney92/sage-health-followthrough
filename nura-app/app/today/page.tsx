import Link from "next/link";
import { CalendarDays, ChevronRight, HeartPulse, MessageCircle, SunMedium } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { NuraActions, RescheduleButton } from "@/components/nura-actions";
import { WhatsAppOpenButton } from "@/components/whatsapp-open-button";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getOrCreateWhatsappLink } from "@/lib/channel-links";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { createWhatsappHref } from "@/lib/whatsapp-link";

const CATEGORY_META: Record<string, { tag: string; tone: string }> = {
  mental_wellbeing: { tag: "Wellbeing", tone: "wellbeing" },
  sleep_energy: { tag: "Wellbeing", tone: "wellbeing" },
  therapy_follow_through: { tag: "Wellbeing", tone: "wellbeing" },
  caregiver_support: { tag: "Wellbeing", tone: "wellbeing" },
  medication_follow_through: { tag: "Medication", tone: "medication" },
};

function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? { tag: "Health", tone: "health" };
}

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function TodayPage() {
  const user = await getSessionUser();
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || "there";
  const avatarUrl = getUserAvatarUrl(user);
  const firstName = displayName.split(" ")[0];

  const supabase = await getSupabaseSessionClient();
  const whatsappLink = user ? await getOrCreateWhatsappLink(supabase, user.id) : null;
  const whatsappLinkCode = whatsappLink?.linked ? null : whatsappLink?.code ?? null;
  const whatsappHref = user ? createWhatsappHref(whatsappLinkCode) : null;

  const today = new Date();
  const weekStart = startOfWeek(today);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayKey = dateKey(today);

  const [{ data: plans }, { data: weekCheckIns }] = await Promise.all([
    user
      ? supabase
          .from("nura_plans")
          .select("id, title, category, current_focus, next_step, updated_at")
          .eq("owner_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(4)
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("nura_check_ins")
          .select("scheduled_for")
          .eq("owner_id", user.id)
          .gte("scheduled_for", weekStart.toISOString())
          .lt("scheduled_for", addDays(weekStart, 7).toISOString())
      : Promise.resolve({ data: null }),
  ]);

  const checkInCountByDay = new Map<string, number>();
  for (const row of weekCheckIns ?? []) {
    const key = dateKey(new Date(row.scheduled_for as string));
    checkInCountByDay.set(key, (checkInCountByDay.get(key) ?? 0) + 1);
  }

  const weekStrip = weekDays.map((date, i) => {
    const key = dateKey(date);
    return { label: WEEKDAY_LABELS[i], day: date.getDate(), count: checkInCountByDay.get(key) ?? 0, isToday: key === todayKey };
  });

  const threads = (plans ?? []).map((plan) => {
    const meta = categoryMeta(plan.category);
    return {
      id: plan.id as string,
      title: plan.title as string,
      tag: meta.tag,
      tone: meta.tone,
      next: (plan.next_step as string) || "Nura will follow up soon.",
    };
  });

  const focusPlan = plans?.[0];

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page today-page">
        <header className="dashboard-heading">
          <span className="auth-kicker">TODAY</span>
          <h1>{greeting(new Date().getHours())}, {firstName} <SunMedium /></h1>
          <p>Here&apos;s what needs your attention today.</p>
        </header>
        <section className="today-next-action">
          <span className="next-action-icon"><MessageCircle /></span>
          <div>
            <small>START HERE</small>
            <h2>{focusPlan ? "Continue with Nura" : "Start by telling Nura what’s going on"}</h2>
            <p>
              {focusPlan
                ? `Nura has started your ${focusPlan.title} Thread. Add one quick update so it can keep the context useful.`
                : "Send a message, voice note, image or file. Nura will organise it into your first Thread."}
            </p>
          </div>
          <div className="next-action-buttons">
            <Link href="/workspace" className="primary-cta"><MessageCircle /> Message in app</Link>
            {whatsappHref && <WhatsAppOpenButton linked={Boolean(whatsappLink?.linked)} />}
          </div>
        </section>
        <div className="today-layout">
          <section className="today-main-column">
            {focusPlan ? (
              <article className="hero-checkin">
                <div className="card-label"><span>Next check-in</span><CalendarDays /></div>
                <h2>{focusPlan.title}</h2>
                <p className="meta">{(focusPlan.current_focus as string) || "Nura is keeping track of this."}</p>
                <p className="checkin-copy">{(focusPlan.next_step as string) || "Nura will check in when it's useful."}</p>
                <div className="button-row">
                  <Link href={`/check-in?planId=${focusPlan.id}&title=${encodeURIComponent(focusPlan.title as string)}`} className="primary-cta">Start check-in</Link>
                  <RescheduleButton planId={focusPlan.id as string} />
                </div>
              </article>
            ) : (
              <article className="hero-checkin">
                <div className="card-label"><span>Get started</span><CalendarDays /></div>
                <h2>Nothing organised yet</h2>
                <p className="checkin-copy">Tell Nura what&apos;s going on and it&apos;ll turn it into your first Thread.</p>
                <div className="button-row">
                  <Link href="/workspace" className="primary-cta">Message Nura</Link>
                </div>
              </article>
            )}

            <div className="section-title-row"><h2>Active Threads</h2><Link href="/plans">View all <ChevronRight /></Link></div>
            {threads.length > 0 ? (
              <div className="thread-grid">
                {threads.map((thread) => (
                  <Link href={`/plans/${thread.id}`} className="thread-card" key={thread.id}>
                    <div className="thread-card-heading">
                      <span className={`thread-icon ${thread.tone}`}><HeartPulse /></span>
                      <span className={`tag ${thread.tone}`}>{thread.tag}</span>
                    </div>
                    <h3>{thread.title}</h3>
                    <small className="next-follow-up-label">Next follow-up</small>
                    <b className="next-follow-up-value">{thread.next}</b>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="checkin-copy">No Threads yet — the first thing you tell Nura will show up here.</p>
            )}

            <div className="section-title-row week-title"><h2>This week</h2><Link href="/calendar">View calendar <ChevronRight /></Link></div>
            <div className="week-strip">
              {weekStrip.map((d) => (
                <div key={d.label} className={d.isToday ? "is-today" : ""}><small>{d.label}</small><b>{d.day}</b><span className={d.count === 0 ? "empty" : ""}>{d.count === 0 ? "—" : d.count}</span></div>
              ))}
            </div>
          </section>
          <aside className="today-rail">
            <article className="rail-card quick-actions-card">
              <h3>Quick actions</h3>
              <NuraActions
                compact
                plans={(plans ?? []).map((plan) => ({ id: plan.id as string, title: plan.title as string }))}
              />
              <Link href="/calendar" className="rail-view-calendar">
                <span className="rail-icon"><CalendarDays /></span>
                <span><b>View calendar</b><small>See your schedule and reminders</small></span>
              </Link>
            </article>
          </aside>
        </div>
      </div>
    </NuraShell>
  );
}
