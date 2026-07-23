"use client";

import Link from "next/link";
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

const conversations = [
  {
    title: "Medical bill",
    question: "Can you explain this bill and tell me if anything looks unusual?",
    time: "Today · 10:42 AM",
    tags: ["Bill analysis", "Review"],
    tone: "sage",
    icon: ReceiptText,
    fresh: true,
  },
  {
    title: "Radiology report",
    question: "What does mild disc degeneration mean?",
    time: "Yesterday · 6:18 PM",
    tags: ["Radiology", "Explanation"],
    tone: "blue",
    icon: FileHeart,
  },
  {
    title: "Insurance EOB",
    question: "Why does this say I may owe £420?",
    time: "15 Jul · 8:03 PM",
    tags: ["Insurance", "EOB review"],
    tone: "violet",
    icon: ShieldCheck,
  },
  {
    title: "Medication question",
    question: "Is it safe to take ibuprofen with my other meds?",
    time: "12 Jul · 11:27 AM",
    tags: ["Medication", "Safety"],
    tone: "mint",
    icon: FileText,
  },
] as const;

export default function HistoryPage() {
  return (
    <ClaritiShell>
      <main className="history-page">
        <section className="history-hero">
          <div>
            <p className="clariti-kicker">YOUR CONVERSATIONS</p>
            <h1>History</h1>
            <p>Past conversations and explanations, ready whenever you want to pick up where you left off.</p>
          </div>
          <button type="button" className="history-filter"><Filter /> <span>Filter</span></button>
        </section>

        <label className="history-search">
          <Search />
          <input aria-label="Search conversations" placeholder="Search conversations..." />
        </label>

        <section className="history-list-section">
          <div className="history-section-head">
            <h2>Recent conversations</h2>
            <button type="button">See all <ChevronRight /></button>
          </div>

          <div className="history-list">
            {conversations.map(({ title, question, time, tags, tone, icon: Icon, fresh }) => (
              <Link href="/workspace" className="history-card" key={title}>
                <span className={`history-art history-art-${tone}`}><Icon /></span>
                <span className="history-card-main">
                  <span className="history-label-line">
                    <span className={`history-dot history-dot-${tone}`} />
                    <span>{title}</span>
                    {fresh ? <em>New</em> : null}
                  </span>
                  <strong>{question}</strong>
                  <span className="history-time"><Clock3 /> {time}</span>
                  <span className="history-tags">
                    {tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </span>
                </span>
                <ChevronRight className="history-chevron" />
              </Link>
            ))}
          </div>
        </section>
      </main>

      <style jsx global>{`
        .history-page{max-width:980px;margin:0 auto;padding:44px 28px 110px}.history-hero{display:flex;align-items:end;justify-content:space-between;gap:24px}.history-hero h1{font:500 40px/1.05 Georgia,"Times New Roman",serif;letter-spacing:-.035em;margin:8px 0 10px;color:#21332f}.history-hero>div>p:last-child{max-width:620px;margin:0;color:#6e7d78;font-size:14px;line-height:1.65}.history-filter{border:1px solid #dce4e0;background:#fff;border-radius:12px;padding:10px 13px;display:flex;align-items:center;gap:7px;color:#465954;font-size:12px;font-weight:700}.history-filter svg{width:16px}.history-search{height:50px;margin:28px 0 30px;border:1px solid #dfe6e3;background:#fff;border-radius:14px;display:flex;align-items:center;gap:10px;padding:0 14px;box-shadow:0 4px 14px rgba(35,63,55,.025)}.history-search svg{width:19px;color:#75837e}.history-search input{flex:1;border:0;outline:0;background:transparent;font-size:14px;color:#243531}.history-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}.history-section-head h2{font-size:17px;margin:0;letter-spacing:-.01em}.history-section-head button{border:0;background:transparent;color:#2f786c;font-size:12px;font-weight:800;display:flex;align-items:center;gap:2px}.history-section-head svg{width:15px}.history-list{display:grid;gap:12px}.history-card{display:grid;grid-template-columns:74px minmax(0,1fr) 22px;gap:17px;align-items:center;text-decoration:none;background:#fff;border:1px solid #e0e6e3;border-radius:18px;padding:17px;box-shadow:0 5px 20px rgba(35,63,55,.035)}.history-card:hover{border-color:#c7d8d2;transform:translateY(-1px);box-shadow:0 10px 26px rgba(35,63,55,.06)}.history-art{width:74px;height:74px;border-radius:17px;display:grid;place-items:center}.history-art svg{width:31px;height:31px;stroke-width:1.7}.history-art-sage{background:#edf7f3;color:#388679}.history-art-blue{background:#eef5fb;color:#4d82b7}.history-art-violet{background:#f4f0fb;color:#7c62b8}.history-art-mint{background:#eff8f2;color:#4d9a70}.history-card-main{display:block;min-width:0}.history-label-line{display:flex;align-items:center;gap:7px;color:#485a55;font-size:11px;font-weight:750}.history-label-line em{margin-left:auto;font-style:normal;padding:4px 8px;border-radius:999px;background:#e8f7ed;color:#2c8050;font-size:9px}.history-dot{width:7px;height:7px;border-radius:50%;flex:none}.history-dot-sage{background:#4db78f}.history-dot-blue{background:#4c9ced}.history-dot-violet{background:#8065dd}.history-dot-mint{background:#56b981}.history-card strong{display:block;margin:7px 0 7px;font-size:15px;line-height:1.45;color:#21332f;letter-spacing:-.01em}.history-time{display:flex;align-items:center;gap:6px;color:#7c8985;font-size:10px}.history-time svg{width:13px}.history-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.history-tags>span{padding:5px 8px;border-radius:999px;background:#f1f5f3;color:#50625c;font-size:9px}.history-chevron{width:18px;color:#82908b}.history-list-section{padding-bottom:20px}
        @media(max-width:760px){.history-page{padding:30px 18px 104px}.history-hero{align-items:flex-start;gap:10px}.history-hero h1{font-size:31px;margin-top:7px}.history-hero>div>p:last-child{font-size:13px;line-height:1.55;max-width:320px}.history-filter{padding:9px 10px;border-radius:11px;margin-top:18px}.history-filter span{display:none}.history-search{margin:22px 0 26px;height:48px;border-radius:13px}.history-section-head h2{font-size:16px}.history-card{grid-template-columns:58px minmax(0,1fr) 16px;gap:13px;padding:14px;border-radius:16px;align-items:start}.history-art{width:58px;height:58px;border-radius:15px}.history-art svg{width:25px;height:25px}.history-card strong{font-size:14px;line-height:1.4;margin:6px 0 7px}.history-label-line{font-size:10px}.history-label-line em{font-size:8px;padding:3px 7px}.history-tags{margin-top:8px}.history-tags>span{font-size:8.5px;padding:4px 7px}.history-chevron{margin-top:25px;width:16px}.history-time{font-size:9.5px}}
      `}</style>
    </ClaritiShell>
  );
}
