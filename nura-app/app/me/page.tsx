import Link from "next/link";
import {
  ChevronRight,
  CreditCard,
  Database,
  Download,
  HeartPulse,
  Link2,
  MessageCircle,
  Phone,
  Radio,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getSubscriptionAccess } from "@/lib/billing/subscription";
import { getWhatsappConnectionStatus } from "@/lib/channel-links";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  in_app: "In the app",
  both: "WhatsApp + app",
};

function formatPhone(phone: string) {
  return phone.startsWith("+") ? phone : `+${phone}`;
}

function initialsFrom(name: string, email: string) {
  const source = name.trim() || email.trim();
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (source.slice(0, 2) || "NU").toUpperCase();
}

export default async function MePage() {
  const user = await getSessionUser();
  const supabase = await getSupabaseSessionClient();

  const [{ data: profile }, whatsapp, access, { count: journeyCount }] = await Promise.all([
    user
      ? supabase.from("nura_profiles").select("display_name, preferred_channel, phone").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? getWhatsappConnectionStatus(supabase, user.id)
      : Promise.resolve({ linked: false, pendingCode: null, expiresAt: null }),
    user ? getSubscriptionAccess(supabase, user.id) : Promise.resolve(null),
    user
      ? supabase
          .from("nura_plans")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .neq("status", "archived")
      : Promise.resolve({ count: 0 }),
  ]);

  const displayName =
    profile?.display_name || (user?.user_metadata?.display_name as string | undefined) || user?.email || "";
  const firstName = displayName.split(" ")[0] || "there";
  const avatarUrl = getUserAvatarUrl(user);
  const phone = (profile?.phone as string | null) || null;
  const channelKey = profile?.preferred_channel || "in_app";
  const channel = CHANNEL_LABEL[channelKey] ?? "WhatsApp";
  const prefersWhatsapp = channelKey === "whatsapp" || channelKey === "both";
  const plusLabel = access?.hasPlus ? "Plus" : access?.status === "trialing" ? "Trial" : "Free";
  const setupGaps = [
    !phone ? "phone number" : null,
    prefersWhatsapp && !whatsapp.linked ? "WhatsApp" : null,
  ].filter(Boolean);
  const statusLine =
    setupGaps.length === 0
      ? `Account ready · ${journeyCount ?? 0} active Care plan${(journeyCount ?? 0) === 1 ? "" : "s"}`
      : `Add ${setupGaps.join(" and ")} so check-ins can reach you.`;

  const followUpItems = [
    {
      href: "/me/preferences",
      title: "Preferences",
      copy: "Follow-up channel, browser alerts, quiet hours",
      Icon: Settings,
      meta: channel,
    },
    {
      href: "/me/connections",
      title: "Connected apps",
      copy: "WhatsApp linking and integrations",
      Icon: Link2,
      meta: whatsapp.linked ? "WhatsApp on" : "WhatsApp off",
    },
    {
      href: "/billing",
      title: "Billing",
      copy: "Nura Plus, trial and web billing",
      Icon: CreditCard,
      meta: plusLabel,
    },
  ] as const;

  const contextItems = [
    {
      href: "/me/health-information",
      title: "Health information",
      copy: "Plans Nura builds from what you share",
      Icon: HeartPulse,
    },
    {
      href: "/me/memory",
      title: "Memory & privacy",
      copy: "What Nura remembers from your updates",
      Icon: Database,
    },
  ] as const;

  const accountItems = [
    {
      href: "/me/data",
      title: "Data & export",
      copy: "Download or permanently delete your data",
      Icon: Download,
    },
    {
      href: "/me/support",
      title: "Support & safety",
      copy: "Help, boundaries and crisis resources",
      Icon: ShieldCheck,
    },
  ] as const;

  return (
    <NuraShell userName={displayName} userAvatarUrl={avatarUrl}>
      <div className="dashboard-page me-page me-v2">
        <header className="dashboard-heading">
          <span className="auth-kicker">ME</span>
          <h1>{firstName}&apos;s account</h1>
          <p>{statusLine}</p>
        </header>

        <div className="me-desktop-top">
          <section className="me-profile-hero">
            <div className="me-profile-hero-main">
              <span
                className="me-profile-avatar"
                style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
                aria-hidden
              >
                {!avatarUrl ? initialsFrom(displayName, user?.email ?? "") : null}
              </span>
              <div className="me-profile-copy">
                <h2>{displayName || "Your profile"}</h2>
                <p>{user?.email}</p>
                <span className={`me-plan-pill ${access?.hasPlus || access?.status === "trialing" ? "is-plus" : ""}`}>
                  {plusLabel} plan
                </span>
              </div>
            </div>
            <Link href="/me/profile" className="secondary-cta me-profile-edit">
              <UserRound size={16} /> Edit profile
            </Link>
          </section>

          <section className="me-reach-card" aria-label="How Nura reaches you">
            <div className="me-section-label">How Nura reaches you</div>
            <Link href="/me/profile" className="me-reach-row">
              <span className="me-reach-icon">
                <Phone />
              </span>
              <span className="me-reach-copy">
                <b>Phone</b>
                <small>{phone ? formatPhone(phone) : "Not added yet"}</small>
              </span>
              <span className="me-reach-trail">
                <span className={`me-status-pill ${phone ? "is-on" : "is-off"}`}>{phone ? "Added" : "Missing"}</span>
                <ChevronRight />
              </span>
            </Link>
            <Link href="/me/preferences" className="me-reach-row">
              <span className="me-reach-icon">
                <Radio />
              </span>
              <span className="me-reach-copy">
                <b>Follow-up channel</b>
                <small>{channel}</small>
              </span>
              <span className="me-reach-trail">
                <span className="me-reach-meta">Change</span>
                <ChevronRight />
              </span>
            </Link>
            <Link href="/me/connections" className="me-reach-row">
              <span className="me-reach-icon">
                <MessageCircle />
              </span>
              <span className="me-reach-copy">
                <b>WhatsApp</b>
                <small>
                  {whatsapp.linked
                    ? "Connected for check-ins"
                    : prefersWhatsapp
                      ? "Needed for your preferred channel"
                      : "Optional for out-of-app updates"}
                </small>
              </span>
              <span className="me-reach-trail">
                <span className={`me-status-pill ${whatsapp.linked ? "is-on" : "is-off"}`}>
                  {whatsapp.linked ? "Connected" : "Not linked"}
                </span>
                <ChevronRight />
              </span>
            </Link>
          </section>
        </div>

        <section className="me-settings-group" aria-label="Settings">
          <div className="me-section-label">Settings</div>
          <div className="me-settings-grid">
            {[
              ...followUpItems.map((item) => ({ ...item, meta: item.meta })),
              ...contextItems.map((item) => ({ ...item, meta: undefined as string | undefined })),
              ...accountItems.map((item) => ({ ...item, meta: undefined as string | undefined })),
            ].map(({ href, title, copy, Icon, meta }) => (
              <Link href={href} key={title} className="me-settings-tile">
                <span className="me-settings-icon">
                  <Icon />
                </span>
                <span className="me-settings-copy">
                  <b>{title}</b>
                  <small>{copy}</small>
                </span>
                {meta ? <span className="me-settings-meta">{meta}</span> : null}
                <ChevronRight className="me-settings-chevron" />
              </Link>
            ))}
          </div>
        </section>

        <SignOutButton className="secondary-cta me-signout" />
      </div>
    </NuraShell>
  );
}
