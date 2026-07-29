import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, FileText, MessageCircle, MoreHorizontal, Pin, UploadCloud } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { RescheduleButton } from "@/components/nura-actions";
import { PlanJourney } from "@/components/plan-journey";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { ensureJourney } from "@/lib/domain/plan-journey";

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

function formatDay(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const supabase = await getSupabaseSessionClient();

  const { data: plan } = user
    ? await supabase.from("nura_plans").select("*").eq("id", id).eq("owner_id", user.id).maybeSingle()
    : { data: null };

  if (!plan) notFound();
  const ownerId = user!.id;
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || "You";
  const avatarUrl = getUserAvatarUrl(user);

  const [{ data: observations }, { data: nextCheckIn }, { data: sourceContexts }, { data: messages }, { count: totalCheckIns }, { count: completedCheckIns }, journey] = await Promise.all([
    supabase.from("nura_observations").select("id, label, value, recorded_at").eq("plan_id", id).order("recorded_at", { ascending: false }).limit(6),
    supabase.from("nura_check_ins").select("id, scheduled_for, channel").eq("plan_id", id).is("completed_at", null).order("scheduled_for", { ascending: true }).limit(1).maybeSingle(),
    supabase.from("nura_source_contexts").select("id, title, created_at").eq("plan_id", id).order("created_at", { ascending: false }).limit(3),
    supabase.from("nura_messages").select("id").eq("plan_id", id).limit(1),
    supabase.from("nura_check_ins").select("id", { count: "exact", head: true }).eq("plan_id", id),
    supabase.from("nura_check_ins").select("id", { count: "exact", head: true }).eq("plan_id", id).not("completed_at", "is", null),
    ensureJourney(supabase, ownerId, {
      id: plan.id as string,
      title: plan.title as string,
      why_this_exists: plan.why_this_exists as string,
      current_focus: plan.current_focus as string,
      next_step: plan.next_step as string,
    }),
  ]);

  const meta = categoryMeta(plan.category as string);
  const total = totalCheckIns ?? 0;
  const completed = completedCheckIns ?? 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const sourceParts: string[] = [];
  if (messages && messages.length > 0) sourceParts.push("Conversations");
  if (total > 0) sourceParts.push("Check-ins");
  if (sourceContexts && sourceContexts.length > 0) sourceParts.push("Documents");

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page">
        <div className="thread-breadcrumb"><Link href="/plans">Threads</Link> <span>›</span> <span>{plan.title as string}</span></div>
        <div className="library-heading">
          <div>
            <h1>{plan.title as string} <span className={`tag ${meta.tone}`}>{meta.tag}</span></h1>
            <p>Started {formatDay(plan.created_at as string)} · Nura is tracking this</p>
            {sourceParts.length > 0 && <small className="thread-source-line">Source: {sourceParts.join(", ")}</small>}
          </div>
        </div>
        <div className="thread-detail">
          <section className="detail-stack">
            <article className="detail-card pinned-note">
              <span className="pinned-note-pin" aria-hidden="true"><Pin /></span>
              <h3>Pinned note</h3>
              <p>{(plan.why_this_exists as string) || (plan.current_focus as string) || "Nura is keeping track of this Thread."}</p>
            </article>
            {total > 0 && (
              <article className="detail-card">
                <h3>Progress</h3>
                <div className="progress-row"><b>{completed} of {total} check-ins</b><span>{pct}%</span></div>
                <div className="progress-track"><span style={{ width: `${pct}%` }} /></div>
              </article>
            )}
            <PlanJourney planId={plan.id as string} milestones={journey} />
            <article className="detail-card">
              <h3>Recent updates</h3>
              {observations && observations.length > 0 ? (
                observations.map((obs) => (
                  <div className="timeline-item" key={obs.id}>
                    <small>{formatDay(obs.recorded_at as string)}</small>
                    <b>{obs.label === "mood" ? `Reported feeling: ${obs.value}` : (obs.value as string)}</b>
                  </div>
                ))
              ) : (
                <p className="checkin-copy">No updates yet — they&apos;ll show up here after your next check-in.</p>
              )}
            </article>
            <article className="detail-card">
              <h3>Shared context</h3>
              {sourceContexts && sourceContexts.length > 0 ? (
                sourceContexts.map((doc) => (
                  <Link href="/upload-review" className="document-link" key={doc.id}>
                    <FileText />
                    <span><b>{doc.title as string}</b><small>Uploaded {formatDay(doc.created_at as string)}</small></span>
                    <MoreHorizontal className="document-link-more" />
                  </Link>
                ))
              ) : (
                <p className="checkin-copy">No files, notes or media shared yet.</p>
              )}
              <Link href={`/workspace?planId=${plan.id}`} className="upload-note-row"><UploadCloud /><span><b>Share context</b><small>Images, voice, documents or notes</small></span></Link>
            </article>
          </section>
          <aside className="detail-stack">
            <article className="detail-card">
              <h3>Next check-in</h3>
              {nextCheckIn ? (
                <div className="next-checkin-channel">
                  <MessageCircle />
                  <span><b>{new Date(nextCheckIn.scheduled_for as string).toLocaleString("en-GB", { weekday: "long", hour: "numeric", minute: "2-digit" })}</b><small>{(nextCheckIn.channel as string) || "WhatsApp"} message</small></span>
                </div>
              ) : (
                <p className="checkin-copy">No check-in scheduled yet.</p>
              )}
              <div className="button-row stacked">
                <Link href={`/check-in?planId=${plan.id}&title=${encodeURIComponent(plan.title as string)}`} className="primary-cta">Start check-in</Link>
                <RescheduleButton planId={plan.id as string} />
              </div>
            </article>
            <article className="detail-card">
              <h3>Tracked items</h3>
              {observations && observations.length > 0 ? (
                <div className="checklist">
                  {Array.from(new Set(observations.map((obs) => obs.label))).map((label) => (
                    <div key={label} className="checklist-row">
                      <CheckCircle2 className="done" />
                      <span><b>{label === "mood" ? "Mood check-ins" : "Notes"}</b><small>Being tracked from your updates</small></span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="checkin-copy">Nura will start tracking items here after your first check-in.</p>
              )}
            </article>
          </aside>
        </div>
      </div>
    </NuraShell>
  );
}
