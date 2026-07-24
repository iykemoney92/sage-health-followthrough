import { Bell, CalendarDays, Footprints, Phone } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";

const events = [
  ["Tomorrow 19:30", "Message check-in", "Sleep, stress, walking", Bell],
  ["Friday 08:00", "Routine reminder", "Daily walk prompt", Footprints],
  ["12 Aug", "GP review prep", "Generate appointment summary", CalendarDays],
  ["Optional", "Voice check-in", "Talk through the Plan", Phone],
] as const;

export default function CalendarPage() {
  return (
    <NuraShell>
      <section className="nura-library">
        <p className="nura-kicker">CALENDAR</p>
        <h1>Follow-up schedule</h1>
        <p className="nura-library-lead">
          Check-ins, reminders, voice sessions, and appointment reviews will live here.
        </p>
        <div className="nura-grid">
          {events.map(([time, title, copy, Icon]) => (
            <article className="plan-card" key={`${time}-${title}`}>
              <Icon />
              <h3>{time}</h3>
              <p><b>{title}</b></p>
              <small>{copy}</small>
            </article>
          ))}
        </div>
      </section>
    </NuraShell>
  );
}
