import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Database,
  Download,
  ExternalLink,
  HeartPulse,
  Link2,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { PreferencesChannelForm } from "@/components/preferences-channel-form";
import { CheckinChannelsForm } from "@/components/checkin-channels-form";
import { PreferencesExtrasForm } from "@/components/preferences-extras-form";
import { PushNotificationsToggle } from "@/components/push-notifications-toggle";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { ExportDataButton } from "@/components/export-data-button";
import { HealthExtrasForm } from "@/components/health-extras-form";
import { MemoryList, type MemoryItem } from "@/components/memory-list";
import { WhatsAppConnectionPanel } from "@/components/whatsapp-connection-panel";
import { getUserAvatarUrl } from "@/lib/avatar";
import { categoryLabel } from "@/lib/domain/journey-naming";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { getWhatsappConnectionStatus } from "@/lib/channel-links";
import { readProfileSettings } from "@/lib/profile-settings";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";
import { NURA_PRODUCT } from "@/lib/product/nura-story";

const copy: Record<string, { title: string; desc: string; Icon: LucideIcon }> = {
  profile: {
    title: "Profile",
    desc: "Name, photo and the number Nura uses for voice check-ins.",
    Icon: UserRound,
  },
  preferences: {
    title: "Preferences",
    desc: "Choose how Nura follows up — and when you want quiet time.",
    Icon: Bell,
  },
  "health-information": {
    title: "Health information",
    desc: "Plans Nura builds from what you share, plus medications and contacts.",
    Icon: HeartPulse,
  },
  memory: {
    title: "Memory & privacy",
    desc: "Review details Nura has stored from your updates.",
    Icon: Database,
  },
  data: {
    title: "Data & export",
    desc: "Download everything, or permanently delete your account.",
    Icon: Download,
  },
  support: {
    title: "Support & safety",
    desc: "What Nura can help with — and where to go in a crisis.",
    Icon: ShieldCheck,
  },
  connections: {
    title: "Connected apps",
    desc: "Link WhatsApp and manage how Nura reaches you outside the app.",
    Icon: Link2,
  },
};

function formatWhen(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SettingsSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "billing") redirect("/billing");
  if (!copy[section]) redirect("/me");

  const supportEmail = process.env.SUPPORT_EMAIL || "support@usenura.app";
  const user = await getSessionUser();
  const supabase = await getSupabaseSessionClient();
  const avatarUrl = getUserAvatarUrl(user);
  const item = copy[section];
  const Icon = item.Icon;
  const settings = readProfileSettings(user?.user_metadata as Record<string, unknown> | undefined);

  let phone = "";
  let preferredChannel = "whatsapp";
  let preferredCheckinChannels: string[] = ["whatsapp", "in_app", "voice"];
  let profileDisplayName =
    (user?.user_metadata?.display_name as string | undefined) || user?.email || "You";
  let whatsappLinked = false;
  let hasPlus = false;
  let journeys: Array<{ id: string; title: string; category: string; current_focus: string; next_step: string }> = [];
  let documents: Array<{ id: string; title: string; summary: string; kind: string; plan_id: string | null }> = [];
  let memories: MemoryItem[] = [];
  let dataStats = {
    journeys: 0,
    messages: 0,
    checkIns: 0,
    documents: 0,
    observations: 0,
  };

  if (user) {
    if (section === "profile" || section === "preferences" || section === "connections") {
      const { data } = await supabase
        .from("nura_profiles")
        .select("display_name, phone, preferred_channel, preferred_checkin_channels")
        .eq("id", user.id)
        .maybeSingle();
      phone = data?.phone || "";
      preferredChannel = data?.preferred_channel || "in_app";
      if (data?.preferred_checkin_channels?.length) preferredCheckinChannels = data.preferred_checkin_channels;
      if (data?.display_name) profileDisplayName = data.display_name;
    }

    if (section === "connections") {
      const [status, access] = await Promise.all([
        getWhatsappConnectionStatus(supabase, user.id),
        getSubscriptionAccess(supabase, user.id),
      ]);
      whatsappLinked = status.linked;
      hasPlus = access.hasPlus;
    }

    if (section === "health-information") {
      const [{ data: plans }, { data: contexts }] = await Promise.all([
        supabase
          .from("nura_plans")
          .select("id, title, category, current_focus, next_step")
          .eq("owner_id", user.id)
          .neq("status", "archived")
          .order("updated_at", { ascending: false })
          .limit(12),
        supabase
          .from("nura_source_contexts")
          .select("id, title, summary, kind, plan_id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      journeys = plans ?? [];
      documents = contexts ?? [];
    }

    if (section === "memory") {
      const [{ data: observations }, { data: contexts }, { data: plans }] = await Promise.all([
        supabase
          .from("nura_observations")
          .select("id, label, value, recorded_at")
          .eq("owner_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(40),
        supabase
          .from("nura_source_contexts")
          .select("id, title, summary, created_at, plan_id")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("nura_plans")
          .select("id, title, current_focus")
          .eq("owner_id", user.id)
          .neq("status", "archived")
          .order("updated_at", { ascending: false })
          .limit(8),
      ]);

      memories = [
        ...(observations ?? []).map((row) => ({
          id: row.id as string,
          text: `${row.label}: ${row.value}`,
          source: "Observation",
          recordedAt: formatWhen(row.recorded_at as string),
        })),
        ...(contexts ?? []).map((row) => ({
          id: `context-${row.id}`,
          text: row.summary || row.title,
          source: "Shared context",
          recordedAt: formatWhen(row.created_at as string),
        })),
        ...(plans ?? [])
          .filter((row) => row.current_focus)
          .map((row) => ({
            id: `focus-${row.id}`,
            text: `${row.title}: ${row.current_focus}`,
            source: "Care plan focus",
            recordedAt: "Active",
          })),
      ].slice(0, 50);
    }

    if (section === "data") {
      const [journeysCount, messagesCount, checkInsCount, documentsCount, observationsCount] = await Promise.all([
        supabase.from("nura_plans").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("nura_messages").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("nura_check_ins").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("nura_source_contexts").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("nura_observations").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
      ]);
      dataStats = {
        journeys: journeysCount.count ?? 0,
        messages: messagesCount.count ?? 0,
        checkIns: checkInsCount.count ?? 0,
        documents: documentsCount.count ?? 0,
        observations: observationsCount.count ?? 0,
      };
    }
  }

  return (
    <NuraShell userName={profileDisplayName} userAvatarUrl={avatarUrl}>
      <div className={`dashboard-page settings-detail-page me-settings-detail me-section-${section}`}>
        <Link href="/me" className="back-link">
          <ArrowLeft /> Me
        </Link>
        <header className="settings-detail-head">
          <span className="settings-hero-icon">
            <Icon />
          </span>
          <div>
            <h1>{item.title}</h1>
            <p>{item.desc}</p>
          </div>
        </header>

        {section === "preferences" && (
          <div className="settings-panels preferences-layout">
            <PreferencesChannelForm initialChannel={preferredChannel} whatsappLinked={whatsappLinked} />
            <CheckinChannelsForm
              initialChannels={preferredCheckinChannels}
              initialPreferred={preferredCheckinChannels[0] ?? null}
              whatsappLinked={whatsappLinked}
              hasPhone={Boolean(phone)}
            />
            <PushNotificationsToggle />
            <PreferencesExtrasForm
              initialQuietHours={settings.quietHours}
              initialStyle={settings.checkinStyle}
            />
          </div>
        )}

        {section === "health-information" && (
          <div className="settings-panels">
            <section>
              <h3>Active Care plans</h3>
              <p className="muted">
                Tailored follow-through areas Nura built from what you’ve shared — not a fixed catalogue.
              </p>
              {journeys.length === 0 ? (
                <p className="muted">
                  No active Care plans yet.{" "}
                  <Link href="/plans/new">Start a Care plan</Link> or message Nura about what’s going on.
                </p>
              ) : (
                <div className="health-journey-list">
                  {journeys.map((journey) => (
                    <Link href={`/plans/${journey.id}`} key={journey.id} className="health-journey-row">
                      <div>
                        <b>{journey.title}</b>
                        <small>
                          {categoryLabel(journey.category).tag} ·{" "}
                          {journey.current_focus || journey.next_step || "In progress"}
                        </small>
                      </div>
                      <span>Open</span>
                    </Link>
                  ))}
                </div>
              )}
              <Link href="/workspace" className="secondary-cta">
                <MessageCircle size={16} /> Tell Nura something new
              </Link>
            </section>

            <HealthExtrasForm
              initialMedications={settings.medications}
              initialContacts={settings.contacts}
            />

            <section>
              <h3>Shared documents & notes</h3>
              <p className="muted">Files and clinician-provided context you’ve shared into Care plans.</p>
              {documents.length === 0 ? (
                <p className="muted">
                  Nothing shared yet. Attach a document in a conversation when you need Nura to remember it.
                </p>
              ) : (
                <div className="health-doc-list">
                  {documents.map((doc) => (
                    <div className="info-row" key={doc.id}>
                      <div>
                        <b>{doc.title}</b>
                        <small>
                          {doc.kind} · {doc.summary.slice(0, 120)}
                          {doc.summary.length > 120 ? "…" : ""}
                        </small>
                      </div>
                      {doc.plan_id ? (
                        <Link href={`/plans/${doc.plan_id}`} className="text-link">
                          Open
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {section === "memory" && (
          <div className="settings-panels">
            <section>
              <h3>What Nura remembers</h3>
              <p className="muted">
                These come from your check-ins and notes. Remove anything you don’t want kept for future follow-ups.
              </p>
              <MemoryList items={memories.filter((row) => row.source === "Observation")} />
            </section>
            {memories.some((row) => row.source !== "Observation") && (
              <section>
                <h3>Related context</h3>
                <p className="muted">
                  Care plan focus lines and document summaries stay with their Care plan. Open a Care plan to change those.
                </p>
                <div className="memory-list">
                  {memories
                    .filter((row) => row.source !== "Observation")
                    .map((row) => (
                      <div className="memory-row" key={row.id}>
                        <div>
                          <span>{row.text}</span>
                          <small>
                            {row.source} · {row.recordedAt}
                          </small>
                        </div>
                        {row.id.startsWith("focus-") ? (
                          <Link href={`/plans/${row.id.replace("focus-", "")}`} className="secondary-cta compact-cta">
                            Open
                          </Link>
                        ) : null}
                      </div>
                    ))}
                </div>
              </section>
            )}
            <section>
              <h3>Privacy note</h3>
              <p className="muted">
                Nura only uses what you’ve shared for follow-through. Export or delete everything anytime from Data &amp;
                export.
              </p>
              <Link href="/me/data" className="secondary-cta">
                Go to Data &amp; export
              </Link>
            </section>
          </div>
        )}

        {section === "data" && (
          <div className="settings-panels">
            <section>
              <h3>What’s stored</h3>
              <p className="muted">A live count of what an export will include for this account.</p>
              <div className="data-stat-grid">
                <div>
                  <b>{dataStats.journeys}</b>
                  <small>Care plans</small>
                </div>
                <div>
                  <b>{dataStats.messages}</b>
                  <small>Messages</small>
                </div>
                <div>
                  <b>{dataStats.checkIns}</b>
                  <small>Check-ins</small>
                </div>
                <div>
                  <b>{dataStats.documents}</b>
                  <small>Documents</small>
                </div>
                <div>
                  <b>{dataStats.observations}</b>
                  <small>Observations</small>
                </div>
                <div>
                  <b>{settings.medications.length + settings.contacts.length}</b>
                  <small>Health list items</small>
                </div>
              </div>
            </section>
            <section>
              <h3>Export</h3>
              <p className="muted">
                Download Care plans, messages, check-ins, documents and channel links as a single JSON file.
              </p>
              <ExportDataButton />
            </section>
            <section className="danger-zone">
              <h3>Delete account</h3>
              <p className="muted">
                Permanently remove your entire Nura account and everything in it. This cannot be undone.
              </p>
              <DeleteAccountButton />
            </section>
          </div>
        )}

        {section === "support" && (
          <div className="settings-panels">
            <section>
              <h3>Nura’s role</h3>
              <p className="muted">{NURA_PRODUCT.roleSupport}</p>
              <p className="muted" style={{ marginTop: "0.75rem" }}>
                {NURA_PRODUCT.summary}
              </p>
            </section>
            <section>
              <h3>Urgent help</h3>
              <p className="muted">
                If you feel unsafe or symptoms may be urgent, contact emergency or urgent-care services rather than
                waiting for Nura.
              </p>
              <div className="support-action-list">
                <a href="tel:999" className="secondary-cta">
                  <PhoneCall size={16} /> Call 999 (UK emergency)
                </a>
                <a href="tel:111" className="secondary-cta">
                  <PhoneCall size={16} /> Call 111 (UK non-emergency)
                </a>
                <a
                  href="https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/"
                  className="secondary-cta"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={16} /> NHS urgent care guidance
                </a>
              </div>
            </section>
            <section>
              <h3>Contact support</h3>
              <p className="muted">
                Questions, account issues, or something not working as expected — email us and we&apos;ll get back to
                you.
              </p>
              <a href={`mailto:${supportEmail}?subject=Nura%20support`} className="secondary-cta">
                {supportEmail}
              </a>
            </section>
          </div>
        )}

        {section === "connections" && (
          <div className="settings-panels connections-panels">
            <WhatsAppConnectionPanel
              initialLinked={whatsappLinked}
              hasPlus={hasPlus}
              preferredChannel={preferredChannel}
            />

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
                  <p className="muted">
                    Check-ins and Care plan events live in Nura&apos;s calendar — no external calendar login needed.
                  </p>
                </div>
              </div>
              <div className="connection-app-actions">
                <Link href="/calendar" className="secondary-cta">
                  Open calendar
                </Link>
              </div>
            </section>

            <section>
              <h3>
                Future health connections <span className="preview-badge">Coming soon</span>
              </h3>
              <p className="muted">
                Apple Health, wearables and clinic record links are on the roadmap. Nothing here shares data until you
                connect it.
              </p>
            </section>
          </div>
        )}

        {section === "profile" && (
          <ProfileSettingsForm
            displayName={profileDisplayName === "You" ? "" : profileDisplayName}
            email={user?.email ?? ""}
            avatarUrl={avatarUrl}
            phone={phone}
          />
        )}
      </div>
    </NuraShell>
  );
}
