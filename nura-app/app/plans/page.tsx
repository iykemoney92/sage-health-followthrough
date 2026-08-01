import Link from "next/link";
import {
  Activity,
  Baby,
  Briefcase,
  CalendarDays,
  FolderHeart,
  HeartPulse,
  MessageCircle,
  Moon,
  Pill,
  Stethoscope,
} from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { ThreadRowMenu } from "@/components/thread-row-menu";
import { ThreadSearchToolbar } from "@/components/thread-search-toolbar";
import { getUserAvatarUrl } from "@/lib/avatar";
import { categoryLabel, channelLabel, formatCheckInWhen } from "@/lib/domain/journey-naming";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const TABS = ["active", "archived", "all"] as const;
type Tab = (typeof TABS)[number];

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
      return FolderHeart;
  }
}

function timeAgo(dateString: string, nowMs: number) {
  const diffMs = nowMs - new Date(dateString).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 14) return `Updated ${days} days ago`;
  return `Updated ${Math.floor(days / 7)} weeks ago`;
}

function tabHref(tab: Tab, searchTerm: string, categoryFilter: string) {
  const params = new URLSearchParams({ tab });
  if (searchTerm) params.set("q", searchTerm);
  if (categoryFilter) params.set("category", categoryFilter);
  return `/plans?${params.toString()}`;
}

export default async function ThreadsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; category?: string }>;
}) {
  const { tab: rawTab, q, category: categoryFilter } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "active";
  const searchTerm = (q ?? "").trim();
  const now = new Date();

  const user = await getSessionUser();
  const supabase = await getSupabaseSessionClient();

  let query = user
    ? supabase
        .from("nura_plans")
        .select("id, title, category, current_focus, next_step, updated_at, status")
        .eq("owner_id", user.id)
    : null;

  if (query && tab === "active") query = query.neq("status", "archived");
  if (query && tab === "archived") query = query.eq("status", "archived");
  if (query && searchTerm) query = query.ilike("title", `%${searchTerm}%`);

  const { data: rawPlans } = query ? await query.order("updated_at", { ascending: false }) : { data: null };

  const planIds = (rawPlans ?? []).map((plan) => plan.id as string);
  const { data: upcomingCheckIns } =
    user && planIds.length > 0
      ? await supabase
          .from("nura_check_ins")
          .select("plan_id, scheduled_for, channel")
          .eq("owner_id", user.id)
          .in("plan_id", planIds)
          .is("completed_at", null)
          .gte("scheduled_for", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
          .order("scheduled_for", { ascending: true })
      : { data: null };

  const nextByPlan = new Map<string, { scheduled_for: string; channel: string | null }>();
  for (const row of upcomingCheckIns ?? []) {
    const planId = row.plan_id as string;
    if (!nextByPlan.has(planId)) {
      nextByPlan.set(planId, {
        scheduled_for: row.scheduled_for as string,
        channel: (row.channel as string | null) ?? null,
      });
    }
  }

  const plans = (rawPlans ?? [])
    .filter((plan) => {
      if (!categoryFilter) return true;
      return categoryLabel((plan.category as string) || "general_health").tone === categoryFilter;
    })
    .map((plan) => {
      const category = (plan.category as string) || "general_health";
      const meta = categoryLabel(category);
      const next = nextByPlan.get(plan.id as string);
      return {
        id: plan.id as string,
        title: plan.title as string,
        category,
        status: (plan.status as string) || "active",
        focus: ((plan.current_focus as string) || "").trim(),
        nextStep: ((plan.next_step as string) || "").trim(),
        updatedAt: plan.updated_at as string,
        tag: meta.tag,
        tone: meta.tone,
        nextWhen: next ? formatCheckInWhen(next.scheduled_for) : null,
        nextChannel: next ? channelLabel(next.channel) : null,
      };
    });

  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email;
  const avatarUrl = getUserAvatarUrl(user);

  const countLabel =
    tab === "archived"
      ? plans.length === 1
        ? "1 archived Care plan"
        : `${plans.length} archived Care plans`
      : plans.length === 1
        ? "1 Care plan Nura is keeping with you"
        : `${plans.length} Care plans Nura is keeping with you`;

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page journeys-page journeys-v2">
        <header className="dashboard-heading">
          <span className="auth-kicker">CARE PLANS</span>
          <h1>Your Care plans</h1>
          <p>
            {plans.length > 0
              ? countLabel
              : tab === "archived"
                ? "Nothing archived yet."
                : "Each Care plan holds one health topic so follow-through doesn’t scatter."}
          </p>
        </header>

        <div className="journeys-controls">
          <div className="thread-tabs" role="tablist" aria-label="Care plan status">
            <Link href={tabHref("active", searchTerm, categoryFilter ?? "")} className={tab === "active" ? "active" : ""}>
              Active
            </Link>
            <Link href={tabHref("archived", searchTerm, categoryFilter ?? "")} className={tab === "archived" ? "active" : ""}>
              Archived
            </Link>
            <Link href={tabHref("all", searchTerm, categoryFilter ?? "")} className={tab === "all" ? "active" : ""}>
              All
            </Link>
          </div>
          <div className="journeys-controls-actions">
            <Link href="/plans/new" className="secondary-cta compact-cta">
              <FolderHeart /> New Care plan
            </Link>
            <ThreadSearchToolbar tab={tab} searchTerm={searchTerm} category={categoryFilter ?? ""} />
          </div>
        </div>

        {plans.length > 0 ? (
          <section className="journey-list" aria-label="Care plan list">
            {plans.map((plan) => {
              const Icon = categoryIcon(plan.category);
              const support =
                plan.nextWhen != null
                  ? `${plan.nextWhen} · via ${plan.nextChannel}`
                  : plan.nextStep || plan.focus || "Nura will follow up when it’s useful.";

              return (
                <article className="journey-card" key={plan.id}>
                  <Link href={`/plans/${plan.id}`} className="journey-card-link">
                    <span className={`thread-icon ${plan.tone}`} aria-hidden>
                      <Icon />
                    </span>
                    <div className="journey-card-body">
                      <div className="journey-card-title-row">
                        <h2>{plan.title}</h2>
                        <span className={`tag ${plan.tone}`}>{plan.tag}</span>
                        {tab === "all" && plan.status === "archived" && (
                          <span className="tag archived">Archived</span>
                        )}
                      </div>
                      {plan.focus ? <p className="journey-card-focus">{plan.focus}</p> : null}
                      <div className="journey-card-meta">
                        {plan.nextWhen ? (
                          <span className="journey-card-next">
                            <CalendarDays aria-hidden />
                            <b>{plan.nextWhen}</b>
                            <small>via {plan.nextChannel}</small>
                          </span>
                        ) : (
                          <span className="journey-card-next muted">
                            <CalendarDays aria-hidden />
                            <b>{support}</b>
                          </span>
                        )}
                        <small className="journey-card-updated">{timeAgo(plan.updatedAt, now.getTime())}</small>
                      </div>
                    </div>
                  </Link>
                  <ThreadRowMenu planId={plan.id} status={plan.status} />
                </article>
              );
            })}
          </section>
        ) : (
          <section className="journeys-empty">
            <span className="journeys-empty-icon" aria-hidden>
              <FolderHeart />
            </span>
            <h2>{tab === "archived" ? "No archived Care plans" : "No Care plans yet"}</h2>
            <p>
              {tab === "archived"
                ? "When you archive a Care plan, it will show up here so Active stays clear."
                : "Tell Nura what’s going on — a message, voice note, or attachment — and it will build a Care plan tailored to you, then schedule check-ins that fit."}
            </p>
            {tab !== "archived" && (
              <div className="button-row">
                <Link href="/plans/new" className="primary-cta">
                  <FolderHeart /> Start a Care plan
                </Link>
                <Link href="/workspace" className="secondary-cta">
                  <MessageCircle /> Message Nura
                </Link>
              </div>
            )}
          </section>
        )}
      </div>
    </NuraShell>
  );
}
