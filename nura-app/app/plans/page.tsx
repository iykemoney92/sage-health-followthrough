import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { ThreadRowMenu } from "@/components/thread-row-menu";
import { ThreadSearchToolbar } from "@/components/thread-search-toolbar";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

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

function timeAgo(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Last updated today";
  if (days === 1) return "Last updated yesterday";
  if (days < 14) return `Last updated ${days} days ago`;
  return `Last updated ${Math.floor(days / 7)} weeks ago`;
}

const TABS = ["active", "archived", "all"] as const;
type Tab = (typeof TABS)[number];

export default async function ThreadsPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; category?: string }> }) {
  const { tab: rawTab, q, category: categoryFilter } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "active";
  const searchTerm = (q ?? "").trim();

  const user = await getSessionUser();
  const supabase = await getSupabaseSessionClient();

  let query = user
    ? supabase.from("nura_plans").select("id, title, category, next_step, updated_at, status").eq("owner_id", user.id)
    : null;

  if (query && tab === "active") query = query.neq("status", "archived");
  if (query && tab === "archived") query = query.eq("status", "archived");
  if (query && searchTerm) query = query.ilike("title", `%${searchTerm}%`);

  const { data: rawPlans } = query ? await query.order("updated_at", { ascending: false }) : { data: null };
  const plans = categoryFilter
    ? rawPlans?.filter((plan) => categoryMeta(plan.category).tone === categoryFilter)
    : rawPlans;

  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email;
  const avatarUrl = getUserAvatarUrl(user);

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page">
        <div className="library-heading"><div><h1>Threads</h1></div></div>
        <div className="thread-tabs">
          <Link href="/plans?tab=active" className={tab === "active" ? "active" : ""}>Active</Link>
          <Link href="/plans?tab=archived" className={tab === "archived" ? "active" : ""}>Archived</Link>
          <Link href="/plans?tab=all" className={tab === "all" ? "active" : ""}>All</Link>
        </div>
        <ThreadSearchToolbar tab={tab} searchTerm={searchTerm} category={categoryFilter ?? ""} />
        {plans && plans.length > 0 ? (
          <section className="thread-list">
            {plans.map((plan) => {
              const meta = categoryMeta(plan.category);
              return (
                <div className="thread-row" key={plan.id}>
                  <Link href={`/plans/${plan.id}`} className="thread-row-link">
                    <span className={`thread-icon ${meta.tone}`}><HeartPulse /></span>
                    <div className="thread-row-main">
                      <span className="thread-row-title-line"><h3>{plan.title}</h3><span className={`tag ${meta.tone}`}>{meta.tag}</span></span>
                      <p>{timeAgo(plan.updated_at as string)}</p>
                    </div>
                    <div className="thread-next"><small>Next follow-up</small><b>{(plan.next_step as string) || "To be scheduled"}</b></div>
                  </Link>
                  <ThreadRowMenu planId={plan.id as string} status={(plan.status as string) ?? "active"} />
                </div>
              );
            })}
          </section>
        ) : (
          <p className="checkin-copy">
            {tab === "archived" ? "No archived Threads." : "No Threads yet. Message Nura to start your first one."}
          </p>
        )}
      </div>
    </NuraShell>
  );
}
