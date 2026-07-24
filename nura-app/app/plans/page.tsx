import { Bell, CalendarDays, CheckCircle2, FileText } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";

const plans = [
  ["Stabilise My Week", "Active", "GP note, stress, sleep, walking", Bell],
  ["Headache Follow-Up", "Paused", "Frequency, severity, triggers", CalendarDays],
  ["Therapy Follow-Through", "Draft", "Trigger reflections between sessions", FileText],
] as const;

export default function PlansPage() {
  return (
    <NuraShell>
      <section className="nura-library">
        <p className="nura-kicker">MY PLANS</p>
        <h1>Living Plans</h1>
        <p className="nura-library-lead">
          Plans collect conversations, uploaded context, reminders, check-ins, and summaries into
          one ongoing health thread.
        </p>
        <div className="nura-grid">
          {plans.map(([title, status, copy, Icon]) => (
            <article className="plan-card" key={title}>
              <Icon />
              <h3>{title}</h3>
              <p>{copy}</p>
              <small><CheckCircle2 /> {status}</small>
            </article>
          ))}
        </div>
      </section>
    </NuraShell>
  );
}
