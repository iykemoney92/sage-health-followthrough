import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronRight,
  FolderHeart,
  HeartPulse,
  MessageCircle,
  Moon,
  Pill,
  Plus,
  Save,
  Settings,
  Stethoscope,
  SunMedium,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { NuraShell } from "@/components/nura-shell";

/**
 * Local-only visual QA surface for desktop/tablet layouts.
 * Available when NODE_ENV=development (middleware allows /dev/*).
 */
export default async function DesktopPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { view = "today" } = await searchParams;
  const known = ["today", "journeys", "calendar", "me", "prefs", "profile", "billing", "modal"] as const;

  return (
    <NuraShell userName="Sarah Thompson" userAvatarUrl={undefined}>
      <div className="desktop-preview-bar">
        <b>Desktop preview</b>
        <nav>
          {[
            ["today", "Today"],
            ["journeys", "Care plans"],
            ["calendar", "Calendar"],
            ["me", "Me"],
            ["profile", "Profile"],
            ["prefs", "Prefs"],
            ["billing", "Billing"],
            ["modal", "Modal"],
          ].map(([id, label]) => (
            <Link key={id} href={`/dev/desktop-preview?view=${id}`} className={view === id ? "active" : ""}>
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {view === "journeys" ? <JourneysPreview /> : null}
      {view === "calendar" ? <CalendarPreview /> : null}
      {view === "me" ? <MePreview /> : null}
      {view === "prefs" ? <PrefsPreview /> : null}
      {view === "profile" ? <ProfilePreview /> : null}
      {view === "billing" ? <BillingPreview /> : null}
      {view === "modal" ? <ModalPreview /> : null}
      {view === "today" || !(known as readonly string[]).includes(view) ? <TodayPreview /> : null}
    </NuraShell>
  );
}

function TodayPreview() {
  return (
    <div className="dashboard-page today-page today-v2">
      <header className="dashboard-heading">
        <span className="auth-kicker">TODAY</span>
        <h1>
          Good evening, Sarah <SunMedium />
        </h1>
        <p>Your next check-in is tonight — keep the week steady.</p>
      </header>

      <div className="today-layout">
        <section className="today-main-column">
          <section className="today-attention">
            <div className="today-attention-kicker">
              <span>Needs you now</span>
              <span className="tag wellbeing">Wellbeing</span>
            </div>
            <div className="today-attention-when">
              <CalendarDays aria-hidden />
              <div>
                <b>Today · 7:30 PM</b>
                <small>via WhatsApp voice</small>
              </div>
            </div>
            <h2>Headaches &amp; sleep rhythm</h2>
            <p className="today-attention-prompt">How have energy and headaches been since yesterday?</p>
            <div className="button-row today-attention-actions">
              <span className="primary-cta">Do check-in</span>
              <span className="secondary-cta">
                <MessageCircle /> Message Nura
              </span>
              <span className="secondary-cta">Reschedule</span>
            </div>
          </section>

          <article className="today-focus-card">
            <div className="today-focus-head">
              <span className="thread-icon wellbeing">
                <HeartPulse />
              </span>
              <div>
                <small>Focus Care plan</small>
                <h3>Headaches &amp; sleep rhythm</h3>
              </div>
              <span className="today-focus-link">
                Roadmap <ChevronRight />
              </span>
            </div>
            <p>Daily walk, sleep notes, and a gentle check-in so GP advice doesn’t fade.</p>
            <div className="today-focus-next">
              <small>Next step</small>
              <b>Log tonight’s energy before bed.</b>
            </div>
          </article>

          <div className="section-title-row">
            <h2>Also active</h2>
            <span>
              View all <ChevronRight />
            </span>
          </div>
          <div className="thread-grid today-also-grid">
            {(
              [
                ["Work stress check-ins", Briefcase, "stress", "Tomorrow · 8:00 AM"],
                ["Post-clinic BP watch", Activity, "symptoms", "Fri · 6:00 PM"],
                ["Evening meds follow-through", Pill, "medication", "Sat · 9:00 AM"],
                ["Sleep wind-down notes", Moon, "wellbeing", "Sun · 8:30 PM"],
              ] as const satisfies ReadonlyArray<readonly [string, LucideIcon, string, string]>
            ).map(([title, Icon, tone, next]) => (
              <article className="thread-card" key={title}>
                <div className="thread-card-heading">
                  <span className={`thread-icon ${tone}`}>
                    <Icon />
                  </span>
                  <span className={`tag ${tone}`}>{tone}</span>
                </div>
                <h3>{title}</h3>
                <small className="next-follow-up-label">Next</small>
                <b className="next-follow-up-value">{next}</b>
              </article>
            ))}
          </div>

          <div className="section-title-row week-title">
            <h2>This week</h2>
            <span>
              Calendar <ChevronRight />
            </span>
          </div>
          <div className="week-strip">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
              <div key={d} className={i === 3 ? "is-today" : ""}>
                <small>{d}</small>
                <b>{26 + i}</b>
                <span className={i === 1 || i === 5 ? "empty" : ""}>{i === 1 || i === 5 ? "—" : i === 3 ? "2" : "1"}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="today-rail">
          <article className="rail-card quick-actions-card">
            <h3>Quick actions</h3>
            <div className="action-stack">
              <button type="button">
                <span className="rail-icon">
                  <MessageCircle />
                </span>
                <span>
                  <b>Start a new thread</b>
                  <small>Ask Nura anything</small>
                </span>
              </button>
              <button type="button">
                <span className="rail-icon amber">
                  <FolderHeart />
                </span>
                <span>
                  <b>Log a note</b>
                  <small>Capture a quick update</small>
                </span>
              </button>
              <button type="button">
                <span className="rail-icon blue">
                  <Stethoscope />
                </span>
                <span>
                  <b>Upload document</b>
                  <small>Letters, plans, results</small>
                </span>
              </button>
              <button type="button" className="rail-view-calendar">
                <span className="rail-icon">
                  <CalendarDays />
                </span>
                <span>
                  <b>View calendar</b>
                  <small>Check-ins & appointments</small>
                </span>
              </button>
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}

function JourneysPreview() {
  return (
    <div className="dashboard-page journeys-page journeys-v2">
      <header className="dashboard-heading">
        <span className="auth-kicker">JOURNEYS</span>
        <h1>Your Care plans</h1>
        <p>4 Care plans Nura is keeping with you</p>
      </header>
      <div className="journeys-controls">
        <div className="thread-tabs" role="tablist" aria-label="Care plan status">
          <a href="#" className="active">
            Active
          </a>
          <a href="#">Archived</a>
          <a href="#">All</a>
        </div>
      </div>
      <section className="journey-list">
        {[
          ["Headaches & sleep rhythm", "Wellbeing", "Tonight · 7:30 PM", "via WhatsApp"],
          ["Evening meds follow-through", "Medication", "Sat · 9:00 AM", "via WhatsApp"],
          ["Post-clinic BP watch", "Symptoms", "Fri · 6:00 PM", "via In-app"],
          ["Work stress check-ins", "Stress", "Tomorrow · 8:00 AM", "via In-app"],
        ].map(([title, tag, when, via]) => (
          <article className="journey-card" key={title}>
            <div className="journey-card-link">
              <span className="thread-icon wellbeing">
                <HeartPulse />
              </span>
              <div className="journey-card-body">
                <div className="journey-card-title-row">
                  <h2>{title}</h2>
                  <span className="tag wellbeing">{tag}</span>
                </div>
                <p className="journey-card-focus">Keep follow-through steady between appointments.</p>
                <div className="journey-card-meta">
                  <span className="journey-card-next">
                    <CalendarDays />
                    <b>{when}</b>
                    <small>{via}</small>
                  </span>
                  <small className="journey-card-updated">Updated 2h ago</small>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function CalendarPreview() {
  return (
    <div className="dashboard-page calendar-page interactive-calendar calendar-v2">
      <header className="dashboard-heading">
        <span className="auth-kicker">CALENDAR</span>
        <h1>Your week</h1>
        <p>Check-ins and appointments in one place.</p>
      </header>
      <div className="calendar-controls">
        <span className="secondary-cta calendar-today">Today</span>
        <div className="calendar-view-toggle">
          <button type="button" className="active">
            Week
          </button>
          <button type="button">Month</button>
        </div>
      </div>
      <div className="calendar-desktop-layout">
        <div className="week-calendar-card interactive-week-card">
          <div className="week-calendar-header">
            <div className="time-head">Time</div>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
              <div className={`day-head ${i === 4 ? "selected" : ""}`} key={d}>
                {d}
                <b>{27 + i > 31 ? i - 4 : 27 + i}</b>
              </div>
            ))}
          </div>
          <div className="week-calendar-body" style={{ minHeight: 420 }}>
            <div className="time-column">
              {["7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM"].map((t) => (
                <div key={t}>{t}</div>
              ))}
            </div>
            <div className="week-grid" style={{ position: "relative", minHeight: 420 }}>
              <button
                type="button"
                className="desktop-calendar-event wellbeing"
                style={{ left: "calc(57.14% + 8px)", width: "calc(14.28% - 16px)", top: 180, height: 56 }}
              >
                <b>Symptoms to watch</b>
                <span>WhatsApp · 6:00 PM</span>
              </button>
              <button
                type="button"
                className="desktop-calendar-event wellbeing"
                style={{ left: "calc(57.14% + 8px)", width: "calc(14.28% - 16px)", top: 250, height: 56 }}
              >
                <b>Symptoms to watch</b>
                <span>In-app · 7:00 PM</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MePreview() {
  return (
    <div className="dashboard-page me-page me-v2">
      <header className="dashboard-heading">
        <span className="auth-kicker">ME</span>
        <h1>Your space</h1>
        <p>Profile, preferences, and how Nura reaches you.</p>
      </header>
      <div className="me-desktop-top">
        <article className="profile-card me-profile-hero">
          <span className="profile-photo soft">ST</span>
          <div>
            <h2>Sarah Thompson</h2>
            <p>sarah.nura.demo@example.com</p>
            <small>+44 7700 900123</small>
          </div>
          <span className="secondary-cta">Edit profile</span>
        </article>
        <article className="channel-card me-reach-card">
          <h2>
            <span className="channel-dot" /> WhatsApp
          </h2>
          <p>We’ll use this for check-ins and important updates.</p>
          <span className="secondary-cta">Change</span>
        </article>
      </div>
      <div className="me-settings-grid">
        {[
          ["Preferences", "Reminders, check-ins, quiet hours", Bell],
          ["Health information", "Medications, conditions, contacts", HeartPulse],
          ["Memory & privacy", "What Nura remembers and why", FolderHeart],
          ["Data & export", "Export or delete your data", Settings],
          ["Support & safety", "Help and crisis resources", MessageCircle],
          ["Connected apps", "Manage integrations", Stethoscope],
        ].map(([title, desc, Icon]) => (
          <a className="me-settings-tile" href="#" key={title as string}>
            <span className="me-settings-icon">
              <Icon />
            </span>
            <span className="me-settings-copy">
              <b>{title as string}</b>
              <small>{desc as string}</small>
            </span>
            <span className="me-settings-meta">Open</span>
            <ChevronRight className="me-settings-chevron" />
          </a>
        ))}
      </div>
    </div>
  );
}

function PrefsPreview() {
  return (
    <div className="dashboard-page settings-detail-page me-settings-detail me-section-preferences">
      <header className="settings-detail-head">
        <span className="settings-hero-icon">
          <Bell />
        </span>
        <div>
          <h1>Preferences</h1>
          <p>Choose how Nura follows up — and when you want quiet time.</p>
        </div>
      </header>
      <div className="settings-panels preferences-layout">
        <section className="pref-panel">
          <div className="pref-panel-head">
            <h3>Follow-up channel</h3>
            <p>Where Nura sends chats and updates.</p>
          </div>
          <div className="pref-choice-grid">
            <button type="button" className="pref-choice-card is-selected">
              <span className="pref-choice-icon">
                <MessageCircle />
              </span>
              <span className="pref-choice-copy">
                <b>In-app</b>
                <small>Inside Nura only</small>
              </span>
            </button>
            <button type="button" className="pref-choice-card">
              <span className="pref-choice-icon">
                <MessageCircle />
              </span>
              <span className="pref-choice-copy">
                <b>WhatsApp</b>
                <small>Messages on WhatsApp</small>
              </span>
            </button>
            <button type="button" className="pref-choice-card">
              <span className="pref-choice-icon">
                <MessageCircle />
              </span>
              <span className="pref-choice-copy">
                <b>Both</b>
                <small>App + WhatsApp</small>
              </span>
            </button>
          </div>
        </section>
        <section className="pref-panel">
          <div className="pref-panel-head">
            <h3>Check-in style</h3>
            <p>How Nura should sound.</p>
          </div>
          <div className="pref-choice-grid">
            <button type="button" className="pref-choice-card is-selected">
              <span className="pref-choice-icon">
                <HeartPulse />
              </span>
              <span className="pref-choice-copy">
                <b>Gentle and concise</b>
                <small>Warm, short check-ins</small>
              </span>
            </button>
            <button type="button" className="pref-choice-card">
              <span className="pref-choice-icon">
                <MessageCircle />
              </span>
              <span className="pref-choice-copy">
                <b>More conversational</b>
                <small>Natural back-and-forth</small>
              </span>
            </button>
            <button type="button" className="pref-choice-card">
              <span className="pref-choice-icon">
                <SunMedium />
              </span>
              <span className="pref-choice-copy">
                <b>Very brief</b>
                <small>Just the essentials</small>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfilePreview() {
  return (
    <div className="dashboard-page settings-detail-page me-settings-detail">
      <Link href="/dev/desktop-preview?view=me" className="back-link">
        <ArrowLeft /> Me
      </Link>
      <header className="settings-detail-head">
        <span className="settings-hero-icon">
          <UserRound />
        </span>
        <div>
          <h1>Profile</h1>
          <p>Name, photo and the number Nura uses for voice check-ins.</p>
        </div>
      </header>
      <div className="settings-panels profile-edit-panels">
        <section>
          <h3>Photo & name</h3>
          <p className="muted">This is how you appear across Nura.</p>
          <div className="profile-picture-editor centered">
            <span className="profile-photo large" style={{ background: "#e8dfc8" }} />
          </div>
          <label>
            Name
            <input defaultValue="Ikechukwu Anasiudu" readOnly />
          </label>
          <label>
            Email
            <input defaultValue="ike@example.com" disabled />
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
      </div>
    </div>
  );
}

function BillingPreview() {
  return (
    <div className="dashboard-page billing-page billing-v2">
      <Link href="/dev/desktop-preview?view=me" className="back-link">
        <ArrowLeft /> Me
      </Link>
      <header className="settings-detail-head">
        <span className="settings-hero-icon">
          <Briefcase />
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

function ModalPreview() {
  return (
    <div className="dashboard-page today-page today-v2" style={{ position: "relative", minHeight: "70vh" }}>
      <header className="dashboard-heading">
        <span className="auth-kicker">DESKTOP QA</span>
        <h1>Modal system</h1>
        <p>Static Log an update dialog — labels, spacing, and primary CTA contrast.</p>
      </header>
      <div className="modal-backdrop" style={{ position: "absolute", inset: 0 }}>
        <section className="nura-modal" role="dialog" aria-labelledby="preview-log-title">
          <button type="button" className="modal-close" aria-label="Close">
            <X />
          </button>
          <div className="modal-heading">
            <span className="modal-icon blue">
              <Plus />
            </span>
            <div>
              <h2 id="preview-log-title">Log an update</h2>
              <p>
                Choose the Care plan, then continue with Nura. The message is already prepared so the update stays
                conversational.
              </p>
            </div>
          </div>
          <div className="modal-fields">
            <label>
              <span className="field-label">Related Care plan</span>
              <select defaultValue="symptoms">
                <option value="symptoms">Symptoms to watch</option>
                <option value="meds">Evening meds follow-through</option>
              </select>
            </label>
            <label>
              <span className="field-label">Prepared message</span>
              <textarea
                defaultValue="Update for Symptoms to watch: I want to log how things have been since my last check-in. Today, "
                readOnly
              />
            </label>
          </div>
          <div className="modal-actions modal-actions-triple">
            <button type="button" className="secondary-cta">
              Cancel
            </button>
            <button type="button" className="secondary-cta">
              WhatsApp
            </button>
            <button type="button" className="primary-cta">
              <MessageCircle /> Message in app
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
