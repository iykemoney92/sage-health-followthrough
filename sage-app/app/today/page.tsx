import Link from "next/link";
import { CalendarDays, ChevronRight, MessageCircle, Mic, Sprout } from "lucide-react";

export default function TodayPage() {
  return (
    <main className="min-h-screen bg-[#faf8f3] text-[#17382f]">
      <header className="border-b border-[#e2e7e2] bg-[#fbfaf6]">
        <div className="mx-auto flex h-20 w-full max-w-5xl items-center justify-between px-5">
          <Link href="/" className="font-[var(--font-display)] text-3xl font-semibold">Sage</Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link className="font-semibold text-[#47785e]" href="/today">Today</Link>
            <Link href="#">My Plans</Link>
            <Link href="#">Calendar</Link>
            <Link href="#">Me</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 py-12">
        <p className="text-sm text-[#728078]">Thursday, 23 July</p>
        <h1 className="mt-2 font-[var(--font-display)] text-5xl font-semibold tracking-tight">Good morning, Ike.</h1>
        <p className="mt-3 max-w-2xl text-[#66746d]">Here’s what needs your attention today. Keep it light — one step at a time.</p>

        <div className="mt-10 grid gap-5 md:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-3xl border border-[#dfe6df] bg-white p-6 shadow-[0_16px_40px_rgba(48,73,61,.05)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#5c876f]">Next check-in</span>
                <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">Sleep reset</h2>
                <p className="mt-2 text-sm text-[#6c7a73]">7:00 PM · WhatsApp check-in</p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf4ea] text-[#47785e]"><Sprout /></div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl bg-[#47785e] px-5 py-3 text-sm font-semibold text-white"><MessageCircle size={17}/> Message Sage</button>
              <button className="inline-flex items-center gap-2 rounded-xl border border-[#9eb3a6] bg-white px-5 py-3 text-sm font-semibold text-[#315c49]"><Mic size={17}/> Voice check-in</button>
            </div>
          </section>

          <section className="rounded-3xl border border-[#dfe6df] bg-[#edf4ea] p-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[.12em] text-[#5c876f]">Active plan</span>
                <h3 className="mt-2 font-[var(--font-display)] text-2xl font-semibold">Stabilise My Week</h3>
              </div>
              <span className="text-sm font-semibold">43%</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/80"><div className="h-full w-[43%] rounded-full bg-[#47785e]" /></div>
            <div className="mt-5 flex items-center gap-2 text-sm text-[#627168]"><CalendarDays size={16}/> Day 3 of 7</div>
            <Link href="#" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[#47785e]">View plan <ChevronRight size={16}/></Link>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-[#dfe6df] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-[var(--font-display)] text-2xl font-semibold">This week</h2>
              <p className="mt-1 text-sm text-[#728078]">Your upcoming Sage check-ins and gentle actions.</p>
            </div>
            <Link href="#" className="text-sm font-semibold text-[#47785e]">Open calendar</Link>
          </div>
          <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs">
            {['Thu','Fri','Sat','Sun','Mon','Tue','Wed'].map((day,index)=><div key={day} className={`rounded-2xl px-2 py-4 ${index===0?'bg-[#47785e] text-white':'bg-[#f4f6f2] text-[#627168]'}`}><div>{day}</div><div className="mt-2 text-lg font-semibold">{23+index}</div></div>)}
          </div>
        </section>
      </section>
    </main>
  );
}
