"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Clock3,
  FileHeart,
  FileText,
  Filter,
  ReceiptText,
  Search,
  ShieldCheck,
} from "lucide-react";
import { ClaritiShell } from "@/components/clariti-shell";

type ConversationRow = {
  id: string;
  title: string;
  question: string;
  time: string;
  date: string;
  tags: string[];
  tone: string;
  icon: typeof ReceiptText;
};

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/sessions")
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!alive) return;
        setConversations(payload?.ok ? payload.sessions.map(toConversationRow) : []);
      })
      .catch(() => {
        if (alive) setConversations([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <ClaritiShell>
      <main className="history-page history-page-v3">
        <section className="history-hero-v3">
          <div>
            <h1>History</h1>
            <p>Your conversations with Clariti.<br />Pick up where you left off.</p>
          </div>
          <button type="button" className="history-filter-v3" aria-label="Filter conversations">
            <Filter /> <span>Filter</span>
          </button>
        </section>

        <label className="history-search-v3">
          <Search />
          <input aria-label="Search conversations" placeholder="Search conversations..." />
        </label>

        <section className="history-list-section-v3">
          <h2>Recent conversations</h2>

          {loading ? (
            <div className="history-empty-v3">Loading conversations...</div>
          ) : conversations.length > 0 ? (
            <>
              <div className="history-list-v3">
                {conversations.map(({ id, title, question, time, date, tags, tone, icon: Icon }) => (
                  <Link href={`/workspace?sessionId=${id}`} className="history-card-v3" key={id}>
                    <span className={`history-art-v3 history-art-${tone}`}><Icon /></span>

                    <span className="history-card-main-v3">
                      <span className="history-label-v3">
                        <span className={`history-dot-v3 history-dot-${tone}`} />
                        <span>{title}</span>
                      </span>
                      <strong>{question}</strong>
                      <span className="history-tags-v3">
                        {tags.map((tag) => <span key={tag}>{tag}</span>)}
                      </span>
                    </span>

                    <span className="history-card-side-v3">
                      <span className="history-card-time-v3"><Clock3 /> {time}</span>
                      <span className="history-card-date-v3">{date}</span>
                      <ChevronRight />
                    </span>
                  </Link>
                ))}
              </div>

              <Link href="/history" className="history-view-all-v3"><FileText /> View all conversations</Link>
            </>
          ) : (
            <div className="history-empty-v3">
              <strong>No conversations yet</strong>
              <span>Start with one health document and your saved analyses will appear here.</span>
              <Link href="/">Ask Clariti</Link>
            </div>
          )}
        </section>
      </main>

      <style jsx global>{`
        .history-page-v3{max-width:980px;margin:0 auto;padding:46px 28px 112px}.history-hero-v3{display:flex;align-items:flex-start;justify-content:space-between;gap:24px}.history-hero-v3 h1{font:600 42px/1.02 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-.045em;margin:0 0 13px;color:#1f2f2c}.history-hero-v3 p{margin:0;color:#6f7d79;font-size:16px;line-height:1.55}.history-filter-v3{border:1px solid #d8e1dd;background:#fff;border-radius:14px;padding:11px 14px;display:flex;align-items:center;gap:8px;color:#30423d;font-size:13px;font-weight:700;box-shadow:0 2px 8px rgba(31,52,45,.025)}.history-filter-v3 svg{width:17px;height:17px}.history-search-v3{height:54px;margin:29px 0 38px;border:1px solid #dce4e1;background:#fff;border-radius:14px;display:flex;align-items:center;gap:12px;padding:0 16px;box-shadow:0 5px 18px rgba(35,63,55,.025)}.history-search-v3 svg{width:21px;color:#65736f}.history-search-v3 input{flex:1;border:0;outline:0;background:transparent;font-size:15px;color:#243531}.history-search-v3 input::placeholder{color:#9ba6a2}.history-list-section-v3 h2{font-size:18px;margin:0 0 16px;color:#20302d;letter-spacing:-.015em}.history-list-v3{display:grid;gap:14px}.history-card-v3{display:grid;grid-template-columns:92px minmax(0,1fr) 110px;gap:20px;align-items:center;text-decoration:none;background:#fff;border:1px solid #dfe6e3;border-radius:20px;padding:20px 22px;box-shadow:0 6px 22px rgba(31,52,45,.035);transition:.18s ease}.history-card-v3:hover{border-color:#c5d7d0;transform:translateY(-1px);box-shadow:0 12px 30px rgba(31,52,45,.06)}.history-art-v3{width:92px;height:92px;border-radius:19px;display:grid;place-items:center}.history-art-v3 svg{width:39px;height:39px;stroke-width:1.7}.history-art-sage{background:#edf7f3;color:#388679}.history-art-blue{background:#eef5fb;color:#3e7dc3}.history-art-violet{background:#f4f0fb;color:#7355b4}.history-art-mint{background:#eef8f2;color:#479a70}.history-card-main-v3{min-width:0}.history-label-v3{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:750;color:#30423d}.history-dot-v3{width:8px;height:8px;border-radius:50%;flex:none}.history-dot-sage{background:#43b88d}.history-dot-blue{background:#3d83d6}.history-dot-violet{background:#7655c5}.history-dot-mint{background:#42af7d}.history-card-main-v3 strong{display:block;color:#172724;font-size:18px;line-height:1.38;letter-spacing:-.02em;margin:8px 0 12px}.history-tags-v3{display:flex;gap:7px;flex-wrap:wrap}.history-tags-v3>span{padding:6px 10px;border-radius:9px;background:#f0f5f3;color:#3f5750;font-size:10px;font-weight:650}.history-card-side-v3{height:100%;display:flex;flex-direction:column;align-items:flex-end;justify-content:center;color:#596864}.history-card-time-v3{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:650}.history-card-time-v3 svg{width:14px;height:14px}.history-card-date-v3{font-size:11px;margin-top:6px}.history-card-side-v3>svg{width:18px;height:18px;margin-top:18px;color:#6f7d78}.history-view-all-v3{width:max-content;margin:24px auto 0;display:flex;align-items:center;gap:8px;text-decoration:none;color:#2f786c;font-size:12px;font-weight:800}.history-view-all-v3 svg{width:16px}.history-empty-v3{border:1px solid #dfe6e3;border-radius:18px;background:#fff;padding:28px;text-align:center;color:#71807b;display:grid;gap:8px}.history-empty-v3 strong{color:#21332f;font-size:17px}.history-empty-v3 span{font-size:13px}.history-empty-v3 a{width:max-content;margin:8px auto 0;text-decoration:none;background:#4d8d83;color:#fff;border-radius:11px;padding:10px 13px;font-size:12px;font-weight:800}
        @media(max-width:760px){.history-page-v3{padding:38px 18px 105px}.history-hero-v3 h1{font-size:31px;margin-bottom:10px}.history-hero-v3 p{font-size:13px;line-height:1.55}.history-filter-v3{padding:10px 12px;margin-top:8px;border-radius:12px}.history-filter-v3 span{display:inline}.history-search-v3{height:50px;margin:25px 0 31px;border-radius:13px;padding:0 13px}.history-list-section-v3 h2{font-size:16px;margin-bottom:14px}.history-list-v3{gap:12px}.history-card-v3{grid-template-columns:76px minmax(0,1fr) 72px;gap:14px;padding:14px 13px;border-radius:17px;align-items:center}.history-art-v3{width:76px;height:76px;border-radius:17px}.history-art-v3 svg{width:31px;height:31px}.history-label-v3{font-size:10.5px;gap:6px}.history-dot-v3{width:7px;height:7px}.history-card-main-v3 strong{font-size:15px;line-height:1.38;margin:6px 0 9px}.history-tags-v3{gap:5px}.history-tags-v3>span{padding:5px 8px;border-radius:8px;font-size:8.5px}.history-card-side-v3{align-items:flex-end;justify-content:center}.history-card-time-v3{font-size:9px;white-space:nowrap}.history-card-time-v3 svg{width:12px;height:12px}.history-card-date-v3{font-size:9px;margin-top:4px}.history-card-side-v3>svg{width:16px;height:16px;margin-top:13px}.history-view-all-v3{margin-top:20px;font-size:11px}}
        @media(max-width:430px){.history-page-v3{padding-left:14px;padding-right:14px}.history-card-v3{grid-template-columns:68px minmax(0,1fr) 62px;gap:11px;padding:12px 11px}.history-art-v3{width:68px;height:68px;border-radius:15px}.history-art-v3 svg{width:28px;height:28px}.history-card-main-v3 strong{font-size:14px}.history-tags-v3>span{font-size:8px;padding:4px 7px}.history-card-time-v3,.history-card-date-v3{font-size:8.5px}}
      `}</style>
    </ClaritiShell>
  );
}

function toConversationRow(session: { id: string; title: string; status: string; updated_at: string; question?: string | null }): ConversationRow {
  const lower = session.title.toLowerCase();
  const isRadiology = lower.includes("radiology") || lower.includes("mri");
  const isEob = lower.includes("eob") || lower.includes("claim");
  const isBill = lower.includes("bill");
  const updatedAt = new Date(session.updated_at);

  return {
    id: session.id,
    title: isRadiology ? "Radiology report" : isEob ? "Insurance EOB" : isBill ? "Medical bill" : session.title,
    question: session.question || session.title,
    time: updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    date: updatedAt.toLocaleDateString(),
    tags: [isRadiology ? "Radiology" : isEob ? "Insurance" : isBill ? "Bill analysis" : "Document", session.status],
    tone: isRadiology ? "blue" : isEob ? "violet" : isBill ? "sage" : "mint",
    icon: isRadiology ? FileHeart : isEob ? ShieldCheck : isBill ? ReceiptText : FileText,
  };
}
