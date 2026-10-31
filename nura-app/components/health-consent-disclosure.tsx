import Link from "next/link";
import { Activity, BedDouble, Gauge, HeartPulse, Scale } from "lucide-react";

/**
 * What Nura reads from Apple Health or Health Connect, who receives it and what never happens to
 * it. Apple 5.1.2(i)/5.1.3 and Play's Health Connect rules want this named inside the product
 * before the OS permission sheet. Shared by Me → Health and the onboarding health step so both
 * always say the same thing.
 */
export function HealthConsentDisclosure({ source }: { source: string }) {
  return (
    <>
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
        Nura only reads — it never writes to {source}. You choose which of these to allow on the next screen.
      </p>
      <p>
        <strong>What happens with it.</strong> Nura keeps a daily summary (for example, “6h 40m asleep”) on its
        servers, not every reading, for up to 90 days. When Nura prepares a check-in, a short summary of what’s
        changed is sent to <strong>Anthropic</strong>, which writes Nura’s messages, and during voice calls to{" "}
        <strong>ElevenLabs</strong>, which runs the call. They process it only for your check-in and may not use it
        to train models. Nura may also check in when, for example, your sleep has been much shorter than usual.
      </p>
      <p>
        <strong>What never happens.</strong> Your Care circle never sees it. It’s never shown in notifications or sent
        over WhatsApp. It’s never used for ads or analytics, and never sold.
      </p>
      <p>
        You can disconnect any time in Me → Connections, which deletes everything Nura stored from {source}. Read{" "}
        <Link href="/data-use">how your data is used</Link> and our <Link href="/privacy">privacy policy</Link>.
      </p>
    </>
  );
}
