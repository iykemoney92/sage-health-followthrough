import Link from "next/link";
import { ChevronRight, Filter, HeartPulse, Plus, Search } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";

const threads = [
  ["Work Stress", "Wellbeing", "Last talked about yesterday", "Nura will check in tonight", "wellbeing"],
  ["Headaches", "Health", "2 updates this week", "GP review in 18 days", "health"],
  ["New Medication", "Medication", "Started 5 days ago", "Next check-in tomorrow", "medication"],
  ["Sleep", "Wellbeing", "Mentioned across 4 conversations", "Last update: Poor night", "sleep"],
  ["Back Pain", "Health", "Last updated 5 days ago", "No follow-up scheduled", "health"],
  ["Recovery After Surgery", "Health", "Last updated 2 weeks ago", "Check-in Saturday", "health"],
] as const;

export default function ThreadsPage() {
  return <NuraShell><div className="dashboard-page">
    <div className="page-title-row"><div><p className="eyebrow">THREADS</p><h1>My Threads</h1><p>Nura keeps related conversations, notes, follow-ups and updates together automatically.</p></div><button className="primary-button"><Plus/> New thread</button></div>
    <div className="thread-toolbar"><div className="segmented"><button className="active">Active</button><button>Archived</button><button>All</button></div><label><Search/><input placeholder="Search threads" /></label><button className="filter-button"><Filter/> All categories</button></div>
    <section className="thread-list">
      {threads.map(([title, tag, meta, followup, tone]) => <Link className="thread-row" href={title === "Headaches" ? "/plans/headaches" : "/plans"} key={title}>
        <div className={`thread-icon ${tone}`}><HeartPulse/></div><div className="thread-row-main"><div><h3>{title}</h3><span className={`tag ${tone}`}>{tag}</span></div><p>{meta}</p></div><div className="thread-follow"><small>Next follow-up</small><b>{followup}</b></div><ChevronRight/>
      </Link>)}
    </section>
  </div></NuraShell>;
}