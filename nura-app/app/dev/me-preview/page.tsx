import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  HeartPulse,
  Link2,
  MessageCircle,
  Phone,
  PhoneCall,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { NuraShell } from "@/components/nura-shell";

/**
 * Local-only visual QA for every Me settings sub-page at desktop/tablet widths.
 */
const SECTIONS = [
  ["profile", "Profile"],
  ["preferences", "Prefs"],
  ["health-information", "Health"],
  ["memory", "Memory"],
  ["data", "Data"],
  ["support", "Support"],
  ["connections", "Connect"],
  ["billing", "Billing"],
] as const;

export default async function MePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { section = "profile" } = await searchParams;
  const known = SECTIONS.map(([id]) => id);
  const active = known.includes(section as (typeof known)[number]) ? section : "profile";

  return (
    <NuraShell userName="Sarah Thompson" userAvatarUrl={undefined}>
      <div className="desktop-preview-bar">
        <b>Me pages</b>
        <nav>
          {SECTIONS.map(([id, label]) => (
            <Link key={id} href={`/dev/me-preview?section=${id}`} className={active === id ? "active" : ""}>
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {active === "profile" ? <ProfileSection /> : null}
      {active === "preferences" ? <PreferencesSection /> : null}
      {active === "health-information" ? <HealthSection /> : null}
      {active === "memory" ? <MemorySection /> : null}
      {active === "data" ? <DataSection /> : null}
      {active === "support" ? <SupportSection /> : null}
      {active === "connections" ? <ConnectionsSection /> : null}
      {active === "billing" ? <BillingSection /> : null}
    </NuraShell>
  );
}

function SectionShell({
  section,
  title,
  desc,
  Icon,
  children,
  panelsClass = "settings-panels",
}: {
  section: string;
  title: string;
  desc: string;
  Icon: LucideIcon;
  children: ReactNode;
  panelsClass?: string;
}) {
  return (
    <div className={`dashboard-page settings-detail-page me-settings-detail me-section-${section}`}>
      <Link href="/dev/me-preview?section=profile" className="back-link">
        <ArrowLeft /> Me
      </Link>
      <header className="settings-detail-head">
        <span className="settings-hero-icon">
          <Icon />
        </span>
        <div>
          <h1>{title}</h1>
          <p>{desc}</p>
        </div>
      </header>
      <div className={panelsClass}>{children}</div>
    </div>
  );
}

function ProfileSection() {
  return (
    <SectionShell
      section="profile"
      title="Profile"
      desc="Name, photo and the number Nura uses for voice check-ins."
      Icon={UserRound}
      panelsClass="settings-panels profile-edit-panels"
    >
      <section>
        <h3>Photo & name</h3>
        <p className="muted">This is how you appear across Nura.</p>
        <div className="profile-picture-editor centered">
          <span className="profile-photo large" style={{ background: "#e8dfc8" }} />
        </div>
        <label>
          Name
          <input defaultValue="Sarah Thompson" readOnly />
        </label>
        <label>
          Email
          <input defaultValue="sarah.nura.demo@example.com" disabled />
        </label>
        <p className="muted field-hint">Email comes from your sign-in and can’t be edited here.</p>
      </section>
      <section>
        <h3>Check-in number</h3>
        <p className="muted">
          Number Nura can call for scheduled voice check-ins. WhatsApp linking lives under Connected apps.
        </p>
        <label>
          Phone
          <input defaultValue="+44 7700 900123" readOnly />
        </label>
      </section>
      <button className="primary-cta profile-save-button" type="button">
        <Save /> Save changes
      </button>
    </SectionShell>
  );
}

function PreferencesSection() {
  return (
    <SectionShell
      section="preferences"
      title="Preferences"
      desc="Choose how Nura follows up — and when you want quiet time."
      Icon={Bell}
      panelsClass="settings-panels preferences-layout"
    >
      <section className="pref-panel">
        <div className="pref-panel-head">
          <h3>Follow-up channel</h3>
          <p className="muted">Where scheduled check-ins and important updates should land.</p>
        </div>
        <div className="pref-choice-grid">
          {[
            ["WhatsApp", "Check-ins and updates on WhatsApp"],
            ["In the app", "Stay inside Nura for follow-ups"],
            ["Both", "WhatsApp plus in-app together"],
          ].map(([label, hint], i) => (
            <button key={label} type="button" className={`pref-choice-card ${i === 0 ? "is-selected" : ""}`}>
              <span className="pref-choice-icon">
                <MessageCircle />
              </span>
              <span className="pref-choice-copy">
                <b>{label}</b>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="pref-panel">
        <div className="pref-panel-head">
          <h3>Proactive check-ins</h3>
          <p className="muted">How Nura may reach out first — pick every channel you’re happy with.</p>
        </div>
        <div className="pref-choice-grid pref-choice-grid-multi">
          {[
            [MessageCircle, "WhatsApp text", "A message that opens the check-in"],
            [Phone, "Phone call", "A short voice check-in from Nura"],
            [Smartphone, "In the app", "Browser or in-app notification only"],
          ].map(([Icon, label, hint], i) => {
            const ChoiceIcon = Icon as LucideIcon;
            return (
              <button key={label as string} type="button" className={`pref-choice-card ${i < 2 ? "is-selected" : ""}`}>
                <span className="pref-choice-icon">
                  <ChoiceIcon />
                </span>
                <span className="pref-choice-copy">
                  <b>{label as string}</b>
                  <small>{hint as string}</small>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="pref-panel">
        <div className="pref-panel-head">
          <h3>Browser notifications</h3>
          <p className="muted">Get a nudge in this browser when a check-in is due.</p>
        </div>
        <button type="button" className="pref-notify-card">
          <span className="pref-choice-icon">
            <Bell />
          </span>
          <span className="pref-choice-copy">
            <b>Show in the browser</b>
            <small>Tap to allow nudges when a check-in is due</small>
          </span>
          <span className="pref-switch-pill" aria-hidden />
        </button>
      </section>

      <section className="pref-panel">
        <div className="pref-panel-head">
          <h3>Quiet hours</h3>
          <p className="muted">Pause non-urgent reminders overnight.</p>
        </div>
        <label className="pref-switch-row">
          <span>
            <b>Enable quiet hours</b>
            <small>Hold gentle check-ins between these times</small>
          </span>
          <input type="checkbox" defaultChecked readOnly />
        </label>
        <div className="field-row">
          <label>
            Starts
            <input type="time" defaultValue="22:00" readOnly />
          </label>
          <label>
            Ends
            <input type="time" defaultValue="07:00" readOnly />
          </label>
        </div>
      </section>

      <section className="pref-panel">
        <div className="pref-panel-head">
          <h3>Check-in style</h3>
          <p className="muted">How Nura should sound when it follows up.</p>
        </div>
        <div className="pref-choice-grid">
          {["Gentle and concise", "More conversational", "Very brief"].map((label, i) => (
            <button key={label} type="button" className={`pref-choice-card ${i === 0 ? "is-selected" : ""}`}>
              <span className="pref-choice-icon">
                <HeartPulse />
              </span>
              <span className="pref-choice-copy">
                <b>{label}</b>
                <small>Warm, short check-ins</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </SectionShell>
  );
}

function HealthSection() {
  return (
    <SectionShell
      section="health-information"
      title="Health information"
      desc="Plans Nura builds from what you share, plus medications and contacts."
      Icon={HeartPulse}
    >
      <section>
        <h3>Active Care plans</h3>
        <p className="muted">Tailored follow-through areas Nura built from what you’ve shared — not a fixed catalogue.</p>
        <div className="health-journey-list">
          {[
            ["Headaches & sleep rhythm", "Wellbeing · Log tonight’s energy"],
            ["Evening meds follow-through", "Medication · Evening dose check"],
            ["Post-clinic BP watch", "Symptoms · Track readings"],
          ].map(([title, meta]) => (
            <a href="#" key={title} className="health-journey-row">
              <div>
                <b>{title}</b>
                <small>{meta}</small>
              </div>
              <span>Open</span>
            </a>
          ))}
        </div>
        <a href="#" className="secondary-cta">
          <MessageCircle size={16} /> Tell Nura something new
        </a>
      </section>

      <section>
        <h3>Medications</h3>
        <p className="muted">Keep a simple list Nura can reference during follow-ups.</p>
        <div className="health-item-list">
          <div className="health-item-row">
            <div>
              <b>Amlodipine 5mg</b>
              <small>Evening dose, after food</small>
            </div>
            <button type="button" className="ghost-danger-btn compact">
              Remove
            </button>
          </div>
        </div>
        <div className="health-add-form">
          <label>
            Medication
            <input placeholder="e.g. Amlodipine 5mg" readOnly />
          </label>
          <label>
            Note (optional)
            <input placeholder="Evening dose…" readOnly />
          </label>
          <button type="button" className="secondary-cta">
            <Plus size={16} /> Add medication
          </button>
        </div>
      </section>

      <section>
        <h3>Care contacts</h3>
        <p className="muted">People or clinics you may want Nura to keep in mind.</p>
        <div className="health-item-list">
          <div className="health-item-row">
            <div>
              <b>Dr Patel</b>
              <small>GP · Riverside Clinic</small>
            </div>
            <button type="button" className="ghost-danger-btn compact">
              Remove
            </button>
          </div>
        </div>
        <div className="health-add-form health-add-form-contacts">
          <label>
            Name
            <input placeholder="e.g. Dr Patel" readOnly />
          </label>
          <label>
            Role
            <input placeholder="GP, pharmacist…" readOnly />
          </label>
          <label>
            Note (optional)
            <input placeholder="Clinic days…" readOnly />
          </label>
          <button type="button" className="secondary-cta">
            <Plus size={16} /> Add contact
          </button>
        </div>
      </section>

      <section>
        <h3>Shared documents & notes</h3>
        <p className="muted">Files and clinician-provided context you’ve shared into Care plans.</p>
        <div className="health-doc-list">
          <div className="info-row">
            <div>
              <b>Discharge summary</b>
              <small>letter · Continue amlodipine, review BP in 2 weeks</small>
            </div>
            <a href="#" className="text-link">
              Open
            </a>
          </div>
        </div>
      </section>
    </SectionShell>
  );
}

function MemorySection() {
  return (
    <SectionShell
      section="memory"
      title="Memory & privacy"
      desc="Review details Nura has stored from your updates."
      Icon={Database}
    >
      <section>
        <h3>What Nura remembers</h3>
        <p className="muted">
          These come from your check-ins and notes. Remove anything you don’t want kept for future follow-ups.
        </p>
        <div className="memory-list">
          {[
            ["mood: Better than yesterday — slept through", "Observation · 28 Jul 2026"],
            ["symptom: Mild headache mid-afternoon", "Observation · 27 Jul 2026"],
            ["note: Walked 20 minutes after lunch", "Observation · 26 Jul 2026"],
          ].map(([text, meta]) => (
            <div className="memory-row" key={text}>
              <div>
                <span>{text}</span>
                <small>{meta}</small>
              </div>
              <button type="button" className="ghost-danger-btn compact">
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Related context</h3>
        <p className="muted">Care plan focus lines and document summaries stay with their Care plan.</p>
        <div className="memory-list">
          <div className="memory-row">
            <div>
              <span>Headaches &amp; sleep rhythm: Keep evenings calmer and note energy</span>
              <small>Care plan focus · Active</small>
            </div>
            <a href="#" className="secondary-cta compact-cta">
              Open
            </a>
          </div>
        </div>
      </section>
      <section>
        <h3>Privacy note</h3>
        <p className="muted">
          Nura only uses what you’ve shared for follow-through. Export or delete everything anytime from Data & export.
        </p>
        <a href="#" className="secondary-cta">
          Go to Data & export
        </a>
      </section>
    </SectionShell>
  );
}

function DataSection() {
  return (
    <SectionShell
      section="data"
      title="Data & export"
      desc="Download everything, or permanently delete your account."
      Icon={Download}
    >
      <section>
        <h3>What’s stored</h3>
        <p className="muted">A live count of what an export will include for this account.</p>
        <div className="data-stat-grid">
          {[
            ["4", "Care plans"],
            ["128", "Messages"],
            ["22", "Check-ins"],
            ["3", "Documents"],
            ["41", "Observations"],
            ["2", "Health list items"],
          ].map(([n, label]) => (
            <div key={label}>
              <b>{n}</b>
              <small>{label}</small>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3>Export</h3>
        <p className="muted">
          Download Care plans, messages, check-ins, documents and channel links as a single JSON file.
        </p>
        <button type="button" className="secondary-cta">
          <Download size={16} /> Download my data
        </button>
      </section>
      <section className="danger-zone">
        <h3>Delete account</h3>
        <p className="muted">Permanently remove your entire Nura account and everything in it. This cannot be undone.</p>
        <button type="button" className="ghost-danger-btn">
          Delete my account
        </button>
      </section>
    </SectionShell>
  );
}

function SupportSection() {
  return (
    <SectionShell
      section="support"
      title="Support & safety"
      desc="What Nura can help with — and where to go in a crisis."
      Icon={ShieldCheck}
    >
      <section>
        <h3>Nura’s role</h3>
        <p className="muted">
          Nura helps you follow through between appointments — check-ins, reminders, and keeping care context together.
          It is not a clinician and does not replace urgent care.
        </p>
      </section>
      <section>
        <h3>Urgent help</h3>
        <p className="muted">
          If you feel unsafe or symptoms may be urgent, contact emergency or urgent-care services rather than waiting
          for Nura.
        </p>
        <div className="support-action-list">
          <a href="tel:999" className="secondary-cta">
            <PhoneCall size={16} /> Call 999 (UK emergency)
          </a>
          <a href="tel:111" className="secondary-cta">
            <PhoneCall size={16} /> Call 111 (UK non-emergency)
          </a>
          <a href="#" className="secondary-cta">
            <ExternalLink size={16} /> NHS urgent care guidance
          </a>
        </div>
      </section>
      <section>
        <h3>Contact support</h3>
        <p className="muted">Questions, account issues, or something not working as expected.</p>
        <a href="mailto:support@usenura.app" className="secondary-cta">
          support@usenura.app
        </a>
      </section>
    </SectionShell>
  );
}

function ConnectionsSection() {
  return (
    <SectionShell
      section="connections"
      title="Connected apps"
      desc="Link WhatsApp and manage how Nura reaches you outside the app."
      Icon={Link2}
      panelsClass="settings-panels connections-panels"
    >
      <section className="connection-app-card whatsapp-connection-card">
        <div className="connection-app-head">
          <span className="connection-app-icon" aria-hidden>
            <MessageCircle />
          </span>
          <div>
            <div className="connection-app-title-row">
              <h3>WhatsApp</h3>
              <span className="connection-status-pill is-pending">Not connected</span>
            </div>
            <p className="muted">Link WhatsApp so Nura can follow up outside the app.</p>
          </div>
        </div>
        <p className="connection-plus-note">
          WhatsApp follow-up is included with Nura Plus or an active trial. <a href="#">Manage billing</a>
        </p>
        <div className="connection-app-actions">
          <button type="button" className="primary-cta">
            Connect WhatsApp
          </button>
          <button type="button" className="secondary-cta">
            Refresh status
          </button>
        </div>
      </section>

      <section className="connection-app-card">
        <div className="connection-app-head">
          <span className="connection-app-icon" aria-hidden>
            <CalendarDays />
          </span>
          <div>
            <div className="connection-app-title-row">
              <h3>Nura calendar</h3>
              <span className="connection-status-pill is-connected">Built in</span>
            </div>
            <p className="muted">Check-ins and Care plan events live in Nura’s calendar.</p>
          </div>
        </div>
        <div className="connection-app-actions">
          <a href="#" className="secondary-cta">
            Open calendar
          </a>
        </div>
      </section>

      <section>
        <h3>
          Future health connections <span className="preview-badge">Coming soon</span>
        </h3>
        <p className="muted">
          Apple Health, wearables and clinic record links are on the roadmap. Nothing here shares data until you connect
          it.
        </p>
      </section>
    </SectionShell>
  );
}

function BillingSection() {
  return (
    <div className="dashboard-page billing-page billing-v2">
      <Link href="/dev/me-preview?section=profile" className="back-link">
        <ArrowLeft /> Me
      </Link>
      <header className="settings-detail-head">
        <span className="settings-hero-icon">
          <CreditCard />
        </span>
        <div>
          <h1>Billing</h1>
          <p>Nura Plus unlocks voice, WhatsApp follow-up, and more than one active Care plan.</p>
        </div>
      </header>
      <section className="billing-status-card">
        <div className="billing-status-copy">
          <small>Current access</small>
          <div className="billing-status-title-row">
            <h2>Free plan</h2>
            <span className="me-status-pill is-off">Free</span>
          </div>
          <p>Core check-ins and one active Care plan.</p>
        </div>
        <div className="billing-actions">
          <button type="button" className="primary-cta">
            Upgrade to Plus
          </button>
          <button type="button" className="secondary-cta">
            Manage or cancel
          </button>
        </div>
      </section>
    </div>
  );
}
