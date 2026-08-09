"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarClock, ChevronRight, Mail, RefreshCw } from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";

type FollowUpRow = {
  id: string;
  session_id: string;
  channel: "email" | "phone" | "in_app";
  action: string;
  document_title: string;
  document_kind: string;
  phone_number?: string | null;
  scheduled_for: string;
  call_status?: string | null;
  triggered_at?: string | null;
  created_at?: string | null;
};

async function fetchFollowUpRows(): Promise<FollowUpRow[]> {
  const response = await fetch("/api/follow-ups", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error ?? "Could not load follow-ups");
  return payload.followUps ?? [];
}

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  async function loadFollowUps() {
    setLoading(true);
    setError(null);
    try {
      setFollowUps(await fetchFollowUpRows());
      setNow(Date.now());
    } catch (caught) {
      setFollowUps([]);
      setError(caught instanceof Error ? caught.message : "Could not load follow-ups");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchFollowUpRows()
      .then((rows) => {
        if (cancelled) return;
        setFollowUps(rows);
        setNow(Date.now());
      })
      .catch((caught) => {
        if (cancelled) return;
        setFollowUps([]);
        setError(caught instanceof Error ? caught.message : "Could not load follow-ups");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    return {
      upcoming: followUps.filter((item) => new Date(item.scheduled_for).getTime() >= now && !item.triggered_at),
      completed: followUps.filter((item) => new Date(item.scheduled_for).getTime() < now || item.triggered_at),
    };
  }, [followUps, now]);

  return (
    <ClaritiShell>
      <main className="followups-page">
        <header className="followups-heading">
          <div>
            <p className="clariti-kicker">FOLLOW-UPS</p>
            <h1>Email check-ins</h1>
            <p>Clariti emails you later about a saved document to ask if anything changed or needs further analysis.</p>
          </div>
          <button type="button" onClick={() => void loadFollowUps()} disabled={loading}>
            <RefreshCw className={loading ? "spinning" : ""} /> Refresh
          </button>
        </header>

        {error ? <p className="followups-error">{error}</p> : null}

        <FollowUpSection title="Upcoming" empty="No upcoming email check-ins yet." rows={grouped.upcoming} />
        <FollowUpSection title="Past or sent" empty="Sent check-ins will appear here." rows={grouped.completed} />
      </main>

      <style jsx global>{`
        .followups-page{max-width:980px;margin:0 auto;padding:46px 28px 112px}.followups-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:34px}.followups-heading h1{font:600 42px/1.02 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-.045em;margin:0 0 12px;color:#1f2f2c}.followups-heading p:not(.clariti-kicker){margin:0;color:#6f7d79;font-size:16px;line-height:1.5;max-width:560px}.followups-heading button{border:1px solid #dce6e2;background:#fff;border-radius:14px;padding:11px 14px;display:flex;align-items:center;gap:8px;color:#2f6e66;font-size:12px;font-weight:800}.followups-heading button svg{width:16px;height:16px}.followups-heading button .spinning{animation:clariti-spin 1s linear infinite}.followups-error{border:1px solid #f0c4bd;background:#fff4f2;color:#ad493d;border-radius:14px;padding:13px 14px;font-size:13px;font-weight:700}.followups-section{margin-top:28px}.followups-section h2{font-size:18px;margin:0 0 14px;color:#22332f;letter-spacing:-.015em}.followups-list{display:grid;gap:12px}.followup-row{display:grid;grid-template-columns:58px minmax(0,1fr) 130px;gap:18px;align-items:center;text-decoration:none;border:1px solid #dfe7e3;background:#fff;border-radius:18px;padding:16px 18px;box-shadow:0 6px 22px rgba(31,52,45,.035);color:#20312d}.followup-icon{width:52px;height:52px;border-radius:14px;background:#edf7f3;color:#3b877b;display:grid;place-items:center}.followup-icon svg{width:23px;height:23px}.followup-main{min-width:0}.followup-main strong{display:block;font-size:16px;line-height:1.25;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.followup-main span{display:block;color:#65736f;font-size:12px;line-height:1.45;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.followup-meta{display:flex;align-items:center;justify-content:flex-end;gap:10px;color:#61706b;font-size:11px;font-weight:750;text-align:right}.followup-status{display:inline-flex;align-items:center;border-radius:999px;background:#edf5f2;color:#2f6e66;padding:6px 9px;text-transform:capitalize}.followup-empty{border:1px dashed #d3dfda;border-radius:18px;padding:26px;text-align:center;color:#71807b;background:#fff}.followup-empty svg{width:24px;height:24px;color:#4d8d83;margin-bottom:8px}@keyframes clariti-spin{to{transform:rotate(360deg)}}@media(max-width:760px){.followups-page{padding:38px 18px 105px}.followups-heading{display:grid}.followups-heading h1{font-size:32px}.followup-row{grid-template-columns:48px minmax(0,1fr);gap:13px;padding:14px}.followup-icon{width:46px;height:46px}.followup-meta{grid-column:2;justify-content:space-between;text-align:left}.followup-main strong{font-size:14px}.followup-main span{white-space:normal}}
      `}</style>
    </ClaritiShell>
  );
}

function FollowUpSection({ empty, rows, title }: { empty: string; rows: FollowUpRow[]; title: string }) {
  return (
    <section className="followups-section">
      <h2>{title}</h2>
      {rows.length > 0 ? (
        <div className="followups-list">
          {rows.map((row) => (
            <Link className="followup-row" href={`/workspace?sessionId=${row.session_id}`} key={row.id}>
              <span className="followup-icon">{row.channel === "email" || looksLikeEmail(row.phone_number) ? <Mail /> : <Bell />}</span>
              <span className="followup-main">
                <strong>{row.action || row.document_title}</strong>
                <span>{row.document_title} · {row.phone_number ?? "Account email"}</span>
              </span>
              <span className="followup-meta">
                <span>{formatFollowUpTime(row.scheduled_for)}</span>
                <span className="followup-status">{row.call_status ?? (row.triggered_at ? "triggered" : "scheduled")}</span>
                <ChevronRight />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="followup-empty">
          <CalendarClock />
          <p>{empty}</p>
        </div>
      )}
    </section>
  );
}

function formatFollowUpTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time pending";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function looksLikeEmail(value?: string | null) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}
