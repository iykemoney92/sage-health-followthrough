import Link from "next/link";
import { createElement } from "react";
import {
  Activity,
  Baby,
  Briefcase,
  CalendarDays,
  ChevronRight,
  HeartPulse,
  MessageCircle,
  Moon,
  Pill,
  Stethoscope,
  SunMedium,
} from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { CareDisclaimer } from "@/components/care-disclaimer";
import { NuraActions, RescheduleButton } from "@/components/nura-actions";
import { WhatsAppOpenButton } from "@/components/whatsapp-open-button";
import { getUserAvatarUrl } from "@/lib/avatar";
import { categoryLabel, channelLabel, displayJourneyFocus, formatCheckInWhen, isUsefulDisplayText } from "@/lib/domain/journey-naming";
import { getOrCreateWhatsappLink } from "@/lib/channel-links";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { createWhatsappHref } from "@/lib/whatsapp-link";

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

function categoryIcon(category: string) {
  switch (category) {
    case "medication_follow_through":
      return Pill;
    case "gp_follow_up":
      return Stethoscope;
    case "symptom_monitoring":
      return Activity;
    case "sleep_energy":
      return Moon;
    case "postpartum_aftercare":
      return Baby;
    case "occupational_stress":
      return Briefcase;
    case "mental_wellbeing":
    case "therapy_follow_through":
      return HeartPulse;
    default:
      return HeartPulse;
  }
}

function CategoryIcon({ category }: { category: string }) {
  return createElement(categoryIcon(category));
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

  const [{ data: plans }, { data: weekCheckIns }, { data: nextCheckInRow }, { data: latestUserMessage }] = await Promise.all([
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
    user
      ? supabase
          .from("nura_check_ins")
          .select("id, plan_id, channel, prompt, scheduled_for, nura_plans(id, title, category, current_focus, next_step)")
          .eq("owner_id", user.id)
          .is("completed_at", null)
          .gte("scheduled_for", new Date(today.getTime() - 2 * 60 * 60 * 1000).toISOString())
          .order("scheduled_for", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("nura_messages")
          .select("content")
          .eq("owner_id", user.id)
          .eq("role", "user")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
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

  const relatedPlanRaw = nextCheckInRow?.nura_plans;
  const relatedPlan = Array.isArray(relatedPlanRaw) ? relatedPlanRaw[0] : relatedPlanRaw;
  const focusFromCheckIn = relatedPlan
    ? {
        id: relatedPlan.id as string,
        title: relatedPlan.title as string,
        category: (relatedPlan.category as string) || "general_health",
        current_focus: (relatedPlan.current_focus as string) || "",
        next_step: (relatedPlan.next_step as string) || "",
      }
    : null;

  const latestPlan = plans?.[0]
    ? {
        id: plans[0].id as string,
        title: plans[0].title as string,
        category: (plans[0].category as string) || "general_health",
        current_focus: (plans[0].current_focus as string) || "",
        next_step: (plans[0].next_step as string) || "",
      }
    : null;

  const focusPlan = focusFromCheckIn ?? latestPlan;
  const otherJourneys = (plans ?? [])
    .filter((plan) => plan.id !== focusPlan?.id)
    .slice(0, 2)
    .map((plan) => {
      const meta = categoryLabel(plan.category as string);
      return {
        id: plan.id as string,
        title: plan.title as string,
        tag: meta.tag,
        tone: meta.tone,
        category: (plan.category as string) || "general_health",
        next: (plan.next_step as string) || "Nura will follow up soon.",
      };
    });

  const focusMeta = categoryLabel(focusPlan?.category ?? "general_health");
  const nextWhen = nextCheckInRow?.scheduled_for
    ? formatCheckInWhen(nextCheckInRow.scheduled_for as string)
    : null;
  const nextChannel = channelLabel(nextCheckInRow?.channel as string | undefined);
  const nextPrompt =
    (nextCheckInRow?.prompt as string | undefined)?.trim() ||
    focusPlan?.next_step ||
    "Nura will check in when it’s useful.";

  const latestSnippet = ((latestUserMessage?.content as string | undefined) || "")
    .replace(/\n*\s*Shared \d+ attachments?:.+$/i, "")
    .trim()
    .slice(0, 110);

  const focusSummary = displayJourneyFocus(
    focusPlan?.current_focus,
    "Nura is keeping the important parts together.",
  );

  const attentionLine = focusPlan
    ? isUsefulDisplayText(latestSnippet)
      ? `Continuing from: “${latestSnippet}${latestSnippet.length >= 110 ? "…" : ""}”`
      : nextWhen
        ? `Next check-in ${nextWhen}${nextChannel ? ` via ${nextChannel}` : ""}.`
        : displayJourneyFocus(focusPlan.current_focus, "Here’s what needs your attention today.")
    : "Tell Nura what’s going on — care continues after the appointment.";

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page today-page today-v2">
        <header className="dashboard-heading">
          <span className="auth-kicker">TODAY</span>
          <h1>
            {greeting(today.getHours())}, {firstName} <SunMedium />
          </h1>
          <p>{attentionLine}</p>
          <CareDisclaimer compact />
        </header>

        <div className="today-layout">
          <section className="today-main-column">
            <section className="today-attention">
              {focusPlan && nextCheckInRow ? (
                <>
                  <div className="today-attention-kicker">
                    <span>Needs you now</span>
                    <span className={`tag ${focusMeta.tone}`}>{focusMeta.tag}</span>
                  </div>
                  <div className="today-attention-when">
                    <CalendarDays aria-hidden />
                    <div>
                      <b>{nextWhen}</b>
                      <small>via {nextChannel}</small>
                    </div>
                  </div>
                  <h2>{focusPlan.title}</h2>
                  <p className="today-attention-prompt">{nextPrompt}</p>
                  <div className="button-row today-attention-actions">
                    <Link
                      href={`/check-in?planId=${focusPlan.id}&title=${encodeURIComponent(focusPlan.title)}&prompt=${encodeURIComponent(nextPrompt)}`}
                      className="primary-cta"
                    >
                      Do check-in
                    </Link>
                    <Link href="/workspace" className="secondary-cta">
                      <MessageCircle /> Message Nura
                    </Link>
                    <RescheduleButton planId={focusPlan.id} />
                  </div>
                </>
              ) : focusPlan ? (
                <>
                  <div className="today-attention-kicker">
                    <span>Your focus</span>
                    <span className={`tag ${focusMeta.tone}`}>{focusMeta.tag}</span>
                  </div>
                  <h2>{focusPlan.title}</h2>
                  <p className="meta">{displayJourneyFocus(focusPlan.current_focus, "Nura is keeping track of this.")}</p>
                  <p className="today-attention-prompt">{focusPlan.next_step || "Add an update so Nura can keep this useful."}</p>
                  <div className="button-row today-attention-actions">
                    <Link href="/workspace" className="primary-cta">
                      <MessageCircle /> Message Nura
                    </Link>
                    {whatsappHref && <WhatsAppOpenButton linked={Boolean(whatsappLink?.linked)} />}
                    <Link
                      href={`/plans/${focusPlan.id}`}
                      className="secondary-cta"
                    >
                      Open Care plan
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="today-attention-kicker">
                    <span>Get started</span>
                  </div>
                  <h2>Nothing organised yet</h2>
                  <p className="today-attention-prompt">
                    Share what’s going on — a message, voice note, or attachment — and Nura will turn it into your first Care plan.
                  </p>
                  <div className="button-row today-attention-actions">
                    <Link href="/plans/new" className="primary-cta">
                      Start a Care plan
                    </Link>
                    <Link href="/workspace" className="secondary-cta">
                      <MessageCircle /> Message Nura
                    </Link>
                    {whatsappHref && <WhatsAppOpenButton linked={Boolean(whatsappLink?.linked)} />}
                  </div>
                </>
              )}
            </section>

            {focusPlan && (
              <article className="today-focus-card">
                <div className="today-focus-head">
                  <span className={`thread-icon ${focusMeta.tone}`}>
                    <CategoryIcon category={focusPlan.category} />
                  </span>
                  <div>
                    <small>Focus Care plan</small>
                    <h3>{focusPlan.title}</h3>
                  </div>
                  <Link href={`/plans/${focusPlan.id}`} className="today-focus-link">
                    Roadmap <ChevronRight />
                  </Link>
                </div>
                <p>{focusSummary}</p>
                <div className="today-focus-next">
                  <small>Next step</small>
                  <b>{focusPlan.next_step || "Nura will follow up soon."}</b>
                </div>
              </article>
            )}

            {otherJourneys.length > 0 && (
              <>
                <div className="section-title-row">
                  <h2>Also active</h2>
                  <Link href="/plans">
                    View all <ChevronRight />
                  </Link>
                </div>
                <div className="thread-grid today-also-grid">
                  {otherJourneys.map((thread) => (
                      <Link href={`/plans/${thread.id}`} className="thread-card" key={thread.id}>
                        <div className="thread-card-heading">
                          <span className={`thread-icon ${thread.tone}`}>
                            <CategoryIcon category={thread.category} />
                          </span>
                          <span className={`tag ${thread.tone}`}>{thread.tag}</span>
                        </div>
                        <h3>{thread.title}</h3>
                        <small className="next-follow-up-label">Next</small>
                        <b className="next-follow-up-value">{thread.next}</b>
                      </Link>
                  ))}
                </div>
              </>
            )}

            <div className="section-title-row week-title">
              <h2>This week</h2>
              <Link href="/calendar">
                Calendar <ChevronRight />
              </Link>
            </div>
            <div className="week-strip">
              {weekStrip.map((d) => (
                <div key={d.label} className={d.isToday ? "is-today" : ""}>
                  <small>{d.label}</small>
                  <b>{d.day}</b>
                  <span className={d.count === 0 ? "empty" : ""}>{d.count === 0 ? "—" : d.count}</span>
                </div>
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
            </article>
          </aside>
        </div>
      </div>
    </NuraShell>
  );
}
