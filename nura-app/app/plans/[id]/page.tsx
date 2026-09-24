import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  MessageCircle,
  Pin,
  UploadCloud,
} from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { RescheduleButton } from "@/components/nura-actions";
import { PlanJourney } from "@/components/plan-journey";
import { CareCircleCard } from "@/components/care-circle-card";
import { getPlanAccess, listCircleMembers, readJourney } from "@/lib/care-circle";
import { getUserAvatarUrl } from "@/lib/avatar";
import { categoryLabel, channelLabel, formatCheckInWhen } from "@/lib/domain/journey-naming";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { ensureJourney } from "@/lib/domain/plan-journey";

function formatDay(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const supabase = await getSupabaseSessionClient();

  // RLS decides whether this plan is visible at all: the owner sees it, an active care-circle
  // member sees it read-only, everyone else gets nothing back and lands on 404.
  const access = user ? await getPlanAccess(supabase, user.id, id) : null;
  if (!access) notFound();
  const { plan, role, ownerName } = access;
  const isWatcher = role === "watcher";
  const ownerId = plan.owner_id as string;
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || "You";
  const avatarUrl = getUserAvatarUrl(user);

  const [{ data: observations }, { data: nextCheckIn }, { data: sourceContexts }, { data: messages }, journey, circleMembers] =
    await Promise.all([
      supabase
        .from("nura_observations")
        .select("id, label, value, recorded_at")
        .eq("plan_id", id)
        .order("recorded_at", { ascending: false })
        .limit(6),
      supabase
        .from("nura_check_ins")
        .select("id, scheduled_for, channel, prompt")
        .eq("plan_id", id)
        .is("completed_at", null)
        .order("scheduled_for", { ascending: true })
        .limit(1)
        .maybeSingle(),
      // Documents and the conversation are the owner's alone. RLS would return nothing to a
      // watcher anyway; skipping the queries keeps that intent visible here, not just in SQL.
      isWatcher
        ? Promise.resolve({ data: null })
        : supabase
            .from("nura_source_contexts")
            .select("id, title, created_at")
            .eq("plan_id", id)
            .order("created_at", { ascending: false })
            .limit(3),
      isWatcher
        ? Promise.resolve({ data: null })
        : supabase.from("nura_messages").select("id").eq("plan_id", id).limit(1),
      // ensureJourney drafts milestones when there are none - an owner-only side effect.
      isWatcher
        ? readJourney(supabase, id)
        : ensureJourney(supabase, ownerId, {
            id: plan.id as string,
            title: plan.title as string,
            why_this_exists: plan.why_this_exists as string,
            current_focus: plan.current_focus as string,
            next_step: plan.next_step as string,
          }),
      isWatcher ? Promise.resolve([]) : listCircleMembers(supabase, id),
    ]);

  const meta = categoryLabel((plan.category as string) || "general_health");
  const title = plan.title as string;
  const why =
    ((plan.why_this_exists as string) || "").trim() ||
    ((plan.current_focus as string) || "").trim() ||
    "Nura is keeping the important parts of this Care plan together.";
  const focus = ((plan.current_focus as string) || "").trim();
  const nextWhen = nextCheckIn?.scheduled_for
    ? formatCheckInWhen(nextCheckIn.scheduled_for as string)
    : null;
  const nextChannel = channelLabel(nextCheckIn?.channel as string | undefined);
  const nextPrompt =
    ((nextCheckIn?.prompt as string | undefined) || "").trim() ||
    ((plan.next_step as string) || "").trim() ||
    "Nura will check in when it’s useful.";
  const workspaceHref = `/workspace?planId=${encodeURIComponent(plan.id as string)}&planTitle=${encodeURIComponent(title)}`;
  const checkInHref = `/check-in?planId=${encodeURIComponent(plan.id as string)}&title=${encodeURIComponent(title)}&prompt=${encodeURIComponent(nextPrompt)}`;

  const hasUpdates = Boolean(observations && observations.length > 0);
  const hasDocs = Boolean(sourceContexts && sourceContexts.length > 0);
  const hasConversation = Boolean(messages && messages.length > 0);

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page journey-detail journey-detail-v2">
        <Link href="/plans" className="journey-back">
          <ArrowLeft /> Care plans
        </Link>

        <header className="dashboard-heading">
          <span className="auth-kicker">CARE PLAN</span>
          <h1>{title}</h1>
          <p className="journey-care-topic" aria-label={`Care topic: ${meta.tag}`}>
            <span>Care topic</span>
            <b className={`journey-care-topic-tag ${meta.tone}`}>{meta.tag}</b>
          </p>
          <p>
            Started {formatDay(plan.created_at as string)}
            {isWatcher
              ? ` · Shared with you by ${ownerName ?? "someone"}`
              : hasConversation || hasDocs
                ? " · Built from what you’ve shared"
                : " · Nura is tracking this with you"}
          </p>
        </header>

        {isWatcher && (
          <aside className="circle-banner" role="note">
            <b>{ownerName ?? "Someone"} shared this Care plan with you.</b>
            <span>
              You can see the plan, its journey and check-ins. Their conversation with Nura stays private to them.
            </span>
          </aside>
        )}

        <section className="journey-detail-hero">
          {nextCheckIn ? (
            <>
              <div className="today-attention-kicker">
                <span>Next check-in</span>
              </div>
              <div className="today-attention-when">
                <CalendarDays aria-hidden />
                <div>
                  <b>{nextWhen}</b>
                  <small>via {nextChannel}</small>
                </div>
              </div>
              <p className="journey-detail-prompt">{nextPrompt}</p>
              {!isWatcher && (
                <div className="button-row today-attention-actions">
                  <Link href={checkInHref} className="primary-cta">
                    Do check-in
                  </Link>
                  <Link href={workspaceHref} className="secondary-cta">
                    <MessageCircle /> Message Nura
                  </Link>
                  <RescheduleButton planId={plan.id as string} />
                </div>
              )}
            </>
          ) : isWatcher ? (
            <>
              <div className="today-attention-kicker">
                <span>Check-ins</span>
              </div>
              <h2>No check-in scheduled</h2>
              <p className="journey-detail-prompt">
                Nura will check in with {ownerName ?? "them"} when it&apos;s useful. You&apos;ll see the next one here.
              </p>
            </>
          ) : (
            <>
              <div className="today-attention-kicker">
                <span>Keep this moving</span>
              </div>
              <h2>No check-in scheduled</h2>
              <p className="journey-detail-prompt">
                Message Nura with an update, or ask it to schedule the next follow-up for this Care plan.
              </p>
              <div className="button-row today-attention-actions">
                <Link href={workspaceHref} className="primary-cta">
                  <MessageCircle /> Message Nura
                </Link>
              </div>
            </>
          )}
        </section>

        <article className="detail-card pinned-note journey-pinned-note">
          <span className="pinned-note-pin" aria-hidden="true">
            <Pin />
          </span>
          <h3>Pinned note</h3>
          <p>{why}</p>
          {focus && focus !== why ? (
            <div className="journey-detail-focus">
              <small>Current focus</small>
              <b>{focus}</b>
            </div>
          ) : null}
        </article>

        <PlanJourney planId={plan.id as string} milestones={journey} readOnly={isWatcher} />

        {!isWatcher && <CareCircleCard planId={plan.id as string} initialMembers={circleMembers} />}

        {(hasUpdates || hasDocs) && (
          <section className="journey-detail-activity">
            {hasUpdates && (
              <div className="journey-activity-block">
                <h3>Recent updates</h3>
                <div className="journey-update-list">
                  {observations!.map((obs) => (
                    <div className="journey-update-row" key={obs.id}>
                      <small>{formatDay(obs.recorded_at as string)}</small>
                      <b>{obs.label === "mood" ? `Feeling: ${obs.value}` : (obs.value as string)}</b>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasDocs && (
              <div className="journey-activity-block">
                <h3>Shared context</h3>
                <div className="journey-doc-list">
                  {sourceContexts!.map((doc) => (
                    <Link href={workspaceHref} className="journey-doc-link" key={doc.id}>
                      <FileText aria-hidden />
                      <span>
                        <b>{doc.title as string}</b>
                        <small>Shared {formatDay(doc.created_at as string)}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {!isWatcher && (
          <Link href={workspaceHref} className="journey-share-row">
            <UploadCloud aria-hidden />
            <span>
              <b>Share context</b>
              <small>Images, voice notes, documents or notes</small>
            </span>
          </Link>
        )}
      </div>
    </NuraShell>
  );
}
