import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { HealthConsentActions } from "@/components/health-consent-actions";
import { HealthConsentDisclosure } from "@/components/health-consent-disclosure";
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
            <HealthConsentDisclosure source={source} />
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
