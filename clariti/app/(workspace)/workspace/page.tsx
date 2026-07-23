import { Paperclip, Send, ShieldCheck } from "lucide-react";

const conversations = ["Medical bill", "Radiology report", "Insurance EOB"];
const artifactSections = ["Summary", "Line items", "Amber flags", "Next actions"];

export default function WorkspacePage() {
  return (
    <main className="grid min-h-screen grid-cols-1 border-[var(--border)] lg:grid-cols-[260px_1fr_360px]">
      <aside className="border-b border-[var(--border)] bg-[var(--panel)] p-5 lg:border-b-0 lg:border-r">
        <h1 className="text-xl font-semibold">Clariti</h1>
        <nav className="mt-6 flex flex-col gap-2">
          {conversations.map((conversation) => (
            <button
              className="rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--accent-soft)]"
              key={conversation}
              type="button"
            >
              {conversation}
            </button>
          ))}
        </nav>
      </aside>

      <section className="flex min-h-[70vh] flex-col bg-[var(--background)]">
        <div className="border-b border-[var(--border)] bg-[var(--panel)] px-5 py-4">
          <p className="text-sm font-medium text-[var(--muted)]">Active session</p>
          <h2 className="text-lg font-semibold">Explain a healthcare document</h2>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-4 p-5">
          <div className="max-w-2xl rounded-md border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--accent)]">
              <ShieldCheck size={16} aria-hidden="true" />
              Scaffold placeholder
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              This shell preserves the planned three-panel workflow without implementing the
              product design yet.
            </p>
          </div>
          <form className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel)] p-2">
            <button className="rounded-md p-2 hover:bg-[var(--accent-soft)]" type="button" aria-label="Attach document">
              <Paperclip size={18} aria-hidden="true" />
            </button>
            <input
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none"
              placeholder="Ask about a bill, EOB, report, or medication..."
            />
            <button className="rounded-md bg-[var(--accent)] p-2 text-white" type="button" aria-label="Send message">
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>

      <aside className="border-t border-[var(--border)] bg-[var(--panel)] p-5 lg:border-l lg:border-t-0">
        <h2 className="text-lg font-semibold">Adaptive canvas</h2>
        <div className="mt-4 grid gap-3">
          {artifactSections.map((section) => (
            <div className="rounded-md border border-[var(--border)] p-4" key={section}>
              <p className="text-sm font-medium">{section}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Domain-backed artifact slot.
              </p>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}
