import Link from "next/link";
import { ChevronRight, Database, Download, HeartPulse, Link2, Settings, ShieldCheck, UserRound } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const items=[['preferences','Preferences','Reminders, check-ins and quiet hours',Settings],['health-information','Health information','Medications, conditions and contacts',HeartPulse],['memory','Memory & privacy','What Nura remembers and why',Database],['data','Data & export','Export or delete your data',Download],['support','Support & safety','Get help and crisis resources',ShieldCheck],['connections','Connected apps','Manage integrations',Link2]] as const;

const CHANNEL_LABEL: Record<string, string> = { whatsapp: "WhatsApp", in_app: "In the app", both: "WhatsApp + In app" };

export default async function MePage(){
  const user = await getSessionUser();
  const supabase = await getSupabaseSessionClient();
  const { data: profile } = user
    ? await supabase.from("nura_profiles").select("display_name, preferred_channel").eq("id", user.id).maybeSingle()
    : { data: null };

  const displayName = profile?.display_name || (user?.user_metadata?.display_name as string | undefined) || user?.email || "";
  const avatarUrl = getUserAvatarUrl(user);
  const channel = CHANNEL_LABEL[profile?.preferred_channel ?? "whatsapp"] ?? "WhatsApp";

  return <NuraShell userName={displayName} userAvatarUrl={avatarUrl}><div className="dashboard-page"><div className="library-heading"><div><h1>Me</h1></div></div><div className="settings-grid"><section className="profile-card stacked-card"><div className="profile-card-row"><span className="profile-photo" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}>{avatarUrl ? "" : <UserRound/>}</span><div><h2>{displayName}</h2><p>{user?.email}</p></div></div><Link href="/me/profile" className="secondary-cta">Edit profile</Link></section><section className="profile-card channel-card"><div><small>Preferred follow-up channel</small><h2><span className="channel-dot"/> {channel}</h2><p>We&apos;ll use this for check-ins and important updates.</p></div><Link href="/me/preferences" className="secondary-cta">Change</Link></section><div className="settings-cards">{items.map(([slug,title,copy,Icon])=><Link href={`/me/${slug}`} key={title} className="settings-link settings-card"><span><Icon/></span><div><b>{title}</b><small>{copy}</small></div><ChevronRight/></Link>)}</div></div></div></NuraShell>;
}
