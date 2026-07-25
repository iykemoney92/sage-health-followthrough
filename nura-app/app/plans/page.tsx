import Link from "next/link";
import { HeartPulse, MoreHorizontal, Plus, Search } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
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

export default async function ThreadsPage() {
  const user = await getSessionUser();
  const supabase = await getSupabaseSessionClient();
  const { data: plans } = user
    ? await supabase
        .from("nura_plans")
        .select("id, title, category, next_step, updated_at")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false })
    : { data: null };

  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email;
  const avatarUrl = getUserAvatarUrl(user);

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page">
        <div className="library-heading"><div><h1>Threads</h1></div></div>
        <div className="thread-tabs">
          <button className="active">Active</button>
          <button>Archived</button>
          <button>All</button>
        </div>
        <div className="threads-toolbar">
          <label className="searchbox"><Search /><input placeholder="Search threads" aria-label="Search threads" /></label>
          <select className="category-select">
            <option>All categories</option>
            <option>Wellbeing</option>
            <option>Health</option>
            <option>Medication</option>
          </select>
          <Link href="/workspace" className="primary-cta"><Plus /> New thread</Link>
        </div>
        {plans && plans.length > 0 ? (
          <section className="thread-list">
            {plans.map((plan) => {
              const meta = categoryMeta(plan.category);
              return (
                <Link href={`/plans/${plan.id}`} key={plan.id} className="thread-row">
                  <span className={`thread-icon ${meta.tone}`}><HeartPulse /></span>
                  <div>
                    <span className="thread-row-title-line"><h3>{plan.title}</h3><span className={`tag ${meta.tone}`}>{meta.tag}</span></span>
                    <p>{timeAgo(plan.updated_at as string)}</p>
                  </div>
                  <div className="thread-next"><small>Next follow-up</small><b>{(plan.next_step as string) || "To be scheduled"}</b></div>
                  <MoreHorizontal className="thread-row-more" />
                </Link>
              );
            })}
          </section>
        ) : (
          <p className="checkin-copy">No Threads yet. Message Nura to start your first one.</p>
        )}
      </div>
    </NuraShell>
  );
}
