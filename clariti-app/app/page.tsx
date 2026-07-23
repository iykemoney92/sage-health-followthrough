import { ArrowRight, FileText, MessageSquare, PanelsTopLeft } from "lucide-react";
import Link from "next/link";

const scaffoldAreas = [
  {
    title: "Document intake",
    copy: "Upload, classify, and prepare bills, EOBs, reports, and other healthcare documents for structured reasoning.",
    icon: FileText,
  },
  {
    title: "Chat session",
    copy: "Keep the central conversation as the control surface for user questions, assistant turns, and clarifying prompts.",
    icon: MessageSquare,
  },
  {
    title: "Adaptive canvas",
    copy: "Render task-specific artifacts beside the chat: line items, report explainers, glossary cards, and follow-up actions.",
    icon: PanelsTopLeft,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
              Clariti scaffold
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Consumer health document copilot</h1>
          </div>
          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-white"
          >
            Open shell
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {scaffoldAreas.map((area) => {
            const Icon = area.icon;

            return (
              <article
                key={area.title}
                className="rounded-md border border-[var(--border)] bg-[var(--panel)] p-5"
              >
                <Icon className="text-[var(--accent)]" size={22} aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold">{area.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{area.copy}</p>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
