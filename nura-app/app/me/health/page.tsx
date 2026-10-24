import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BedDouble, HeartPulse, Scale, Gauge } from "lucide-react";
import { HealthConsentActions } from "@/components/health-consent-actions";
import { NuraLogo } from "@/components/nura-logo";
import { PrivateArea } from "@/components/private-area";
import {
  HEALTH_PLATFORM_LABELS,
  type HealthPlatform,
} from "@/lib/health/metrics";
import { getSessionUser } from "@/lib/integrations/supabase-server";

/**
 * Nura's own consent for health data, shown before the OS permission sheet.
 *
 * Apple 5.1.2(i)/5.1.3 and Play's Health Connect and third-party-AI rules all want
 * the same thing: name the data, name who receives it, get an explicit yes inside
 * the product. Separate from the AI consent gate, which still applies on top.
 */
export default async function HealthConsentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me/health");

  const userAgent = (await headers()).get("user-agent") ?? "";
  const platform: HealthPlatform = /android/i.test(userAgent)
    ? "health_connect"
    : "apple_health";
  const source = HEALTH_PLATFORM_LABELS[platform];

  return (
    <PrivateArea>
      <main className="billing-lock-page">
        <div className="billing-lock-shell">
          <NuraLogo />
          <div
            className="billing-lock-card"
            aria-labelledby="health-consent-title"
          >
            <span className="billing-lock-icon" aria-hidden="true">
              <HeartPulse size={22} strokeWidth={2.2} />
            </span>
            <span className="auth-kicker">CONNECT {source.toUpperCase()}</span>
            <h1 id="health-consent-title">Make check-ins more personal</h1>
            <p>Nura can read five things from {source}:</p>
            <ul className="billing-lock-benefits">
              <li>
                <Activity size={16} strokeWidth={2.2} /> Steps
              </li>
              <li>
                <BedDouble size={16} strokeWidth={2.2} /> Sleep
              </li>
              <li>
                <HeartPulse size={16} strokeWidth={2.2} /> Resting heart rate
              </li>
              <li>
                <Scale size={16} strokeWidth={2.2} /> Weight
              </li>
              <li>
                <Gauge size={16} strokeWidth={2.2} /> Blood pressure
              </li>
            </ul>
            <p>
              Nura only reads — it never writes to {source}. You choose which of
              these to allow on the next screen.
            </p>
            <p>
              <strong>What happens with it.</strong> Nura keeps a daily summary
              (for example, “6h 40m asleep”) on its servers, not every reading,
              for up to 90 days. When Nura prepares a check-in, a short summary
              of what’s changed is sent to <strong>Anthropic</strong>, which
              writes Nura’s messages, and during voice calls to{" "}
              <strong>ElevenLabs</strong>, which runs the call. They process it
              only for your check-in and may not use it to train models. Nura
              may also check in when, for example, your sleep has been much
              shorter than usual.
            </p>
            <p>
              <strong>What never happens.</strong> Your Care circle never sees
              it. It’s never shown in notifications or sent over WhatsApp. It’s
              never used for ads or analytics, and never sold.
            </p>
            <p>
              You can disconnect any time in Me → Connections, which deletes
              everything Nura stored from {source}. Read{" "}
              <Link href="/data-use">how your data is used</Link> and our{" "}
              <Link href="/privacy">privacy policy</Link>.
            </p>
            <HealthConsentActions platform={platform} />
            <Link href="/me/connections" className="billing-lock-footnote">
              Not now
            </Link>
          </div>
        </div>
      </main>
    </PrivateArea>
  );
}
