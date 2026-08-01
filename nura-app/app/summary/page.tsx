import Link from "next/link";
import Anthropic from "@anthropic-ai/sdk";
import { CalendarDays, FileText, TrendingDown } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { ExportSummaryButton } from "@/components/export-summary-button";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

type GeneratedSummary = { headline: string; patterns: string[]; questions: string[] };

const FALLBACK_SUMMARY: GeneratedSummary = {
  headline: "Nura is keeping track of what you've shared.",
  patterns: ["Check back after a few more updates for patterns to appear here."],
  questions: ["What would be most useful to bring up at your next review?"],
};

async function generateSummary(planTitle: string, entries: string[]): Promise<GeneratedSummary> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || entries.length === 0) return FALLBACK_SUMMARY;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system:
        "You write short, non-diagnostic summaries of a user's self-reported health updates for the Nura app. " +
        "Never diagnose, prescribe, or give medical advice - just reflect back what they reported. " +
        "Respond with ONLY a JSON object, no markdown fences: " +
        '{"headline": string (one encouraging, neutral sentence about the trend), "patterns": string[] (1-3 short bullet observations), "questions": string[] (1-3 short questions worth raising with a clinician)}',
      messages: [{ role: "user", content: `Care plan: "${planTitle}". Recent self-reported updates:\n${entries.join("\n")}` }],
    });
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return FALLBACK_SUMMARY;
    const cleaned = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned) as GeneratedSummary;
    if (!parsed.headline || !parsed.patterns || !parsed.questions) return FALLBACK_SUMMARY;
    return parsed;
  } catch {
    return FALLBACK_SUMMARY;
  }
}

export default async function SummaryPage({ searchParams }: { searchParams: Promise<{ planId?: string }> }) {
  const { planId: requestedPlanId } = await searchParams;
  const user = await getSessionUser();
  const displayName = (user?.user_metadata?.display_name as string | undefined) || user?.email || "You";
  const avatarUrl = getUserAvatarUrl(user);
  const supabase = await getSupabaseSessionClient();

  const plan = user
    ? requestedPlanId
      ? (await supabase.from("nura_plans").select("*").eq("id", requestedPlanId).eq("owner_id", user.id).maybeSingle()).data
      : (await supabase.from("nura_plans").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle()).data
    : null;

  if (!plan) {
    return (
      <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
        <div className="dashboard-page summary-page">
          <div className="summary-head"><div><span className="auth-kicker">SUMMARY</span><h1>No summary yet</h1><p>Start a Care plan with Nura and a summary will appear here.</p></div></div>
        </div>
      </NuraShell>
    );
  }

  const [{ data: existingSummary }, { data: observations }, { data: sourceContext }, { data: nextCheckIn }] = await Promise.all([
    supabase.from("nura_appointment_summaries").select("*").eq("plan_id", plan.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("nura_observations").select("id, label, value, recorded_at").eq("plan_id", plan.id).order("recorded_at", { ascending: false }).limit(20),
    supabase.from("nura_source_contexts").select("title, created_at, summary").eq("plan_id", plan.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("nura_check_ins").select("scheduled_for").eq("plan_id", plan.id).is("completed_at", null).order("scheduled_for", { ascending: true }).limit(1).maybeSingle(),
  ]);

  const moodEntries = (observations ?? []).filter((o) => o.label === "mood");
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const thisWeekCount = moodEntries.filter((o) => new Date(o.recorded_at as string) >= startOfWeek).length;
  const moodTally = moodEntries.reduce<Record<string, number>>((acc, o) => { const v = o.value as string; acc[v] = (acc[v] ?? 0) + 1; return acc; }, {});
  const commonMood = Object.entries(moodTally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Not enough data";

  let summary: GeneratedSummary;
  if (existingSummary) {
    summary = {
      headline: existingSummary.user_reported_summary as string,
      patterns: (existingSummary.clinician_context_summary as string || "").split("|").filter(Boolean),
      questions: (existingSummary.suggested_questions as string[]) ?? [],
    };
  } else {
    const entries = (observations ?? []).map((o) => `${o.label}: ${o.value}`);
    summary = await generateSummary(plan.title as string, entries);
    if (entries.length > 0) {
      await supabase.from("nura_appointment_summaries").insert({
        owner_id: user!.id,
        plan_id: plan.id,
        title: `${plan.title} summary`,
        user_reported_summary: summary.headline,
        clinician_context_summary: summary.patterns.join("|"),
        suggested_questions: summary.questions,
      });
    }
  }

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page summary-page">
        <div className="summary-head">
          <div>
            <span className="auth-kicker">SUMMARY</span>
            <h1>Your {plan.title as string} summary</h1>
            <p>A clear, non-diagnostic snapshot of what you&apos;ve reported{sourceContext ? " and the context you shared" : ""}.</p>
          </div>
          <div>
            <ExportSummaryButton planTitle={plan.title as string} summary={summary} />
            <Link href={`/plans/${plan.id}`} className="primary-cta">Back to Care plan</Link>
          </div>
        </div>
        <div className="summary-grid">
          <section className="summary-main">
            <article className="summary-card highlight">
              <TrendingDown />
              <div><small>Since monitoring started</small><h2>{summary.headline}</h2><p>Based on your own logged updates. This is not a diagnosis or clinical interpretation.</p></div>
            </article>
            <article className="summary-card">
              <h3>Symptoms you reported</h3>
              <div className="metric-row">
                <span><b>{moodEntries.length}</b><small>updates logged</small></span>
                <span><b>{thisWeekCount}</b><small>this week</small></span>
                <span><b>{commonMood}</b><small>most common report</small></span>
              </div>
            </article>
            <article className="summary-card">
              <h3>Patterns mentioned</h3>
              <ul>{summary.patterns.map((pattern, i) => <li key={i}>{pattern}</li>)}</ul>
            </article>
            <article className="summary-card">
              <h3>Questions you may want to discuss</h3>
              <ul>{summary.questions.map((question, i) => <li key={i}>{question}</li>)}</ul>
            </article>
          </section>
          <aside className="summary-side">
            <article className="summary-card">
              <FileText />
              <h3>Source context</h3>
              {sourceContext ? (
                <>
                  <p><b>{sourceContext.title as string}</b><br />Uploaded {new Date(sourceContext.created_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                  {sourceContext.summary && <small>{sourceContext.summary as string}</small>}
                </>
              ) : (
                <p>No shared files or notes yet.</p>
              )}
            </article>
            <article className="summary-card">
              <CalendarDays />
              <h3>Next review</h3>
              <p>{nextCheckIn ? new Date(nextCheckIn.scheduled_for as string).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Not yet scheduled"}</p>
              <p className="muted" style={{ fontSize: 9 }}>To add your own question for this review, just message Nura about it.</p>
            </article>
          </aside>
        </div>
      </div>
    </NuraShell>
  );
}
