import { Database, MessageCircle, ShieldCheck, Trash2 } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";

const settings = [
  ["Memory controls", "Review user-approved memories and Plan context.", Database],
  ["WhatsApp and voice", "Set channel preferences and check-in times.", MessageCircle],
  ["Safety and support", "Urgent-care routing, crisis support, and product limits.", ShieldCheck],
  ["Export or delete", "User-controlled data export and deletion flows.", Trash2],
] as const;

export default function MePage() {
  return (
    <NuraShell>
      <section className="nura-library">
        <p className="nura-kicker">ME</p>
        <h1>Your Nura</h1>
        <p className="nura-library-lead">
          The companion should stay transparent: what it remembers, how it follows up, and how data
          can be exported or deleted.
        </p>
        <div className="nura-grid">
          {settings.map(([title, copy, Icon]) => (
            <article className="plan-card" key={title}>
              <Icon />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
    </NuraShell>
  );
}
