import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, MessageSquare, Mic, ShieldCheck } from "lucide-react";
import { AiConsentActions } from "@/components/ai-consent-actions";
import { NuraLogo } from "@/components/nura-logo";
import { SignOutButton } from "@/components/sign-out-button";
import { hasAiConsent } from "@/lib/ai-consent";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { safeNextPath } from "@/lib/auth/safe-path";

/**
 * The consent gate. `middleware.ts` sends every signed-in user here until they
 * agree, so nothing that reaches the model — including the server-rendered
 * summary and plan pages — can run ahead of it.
 */
export default async function AiConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { next } = await searchParams;
  const destination = safeNextPath(next, "") || "/today";

  // Already agreed: nothing to ask, and leaving the gate reachable would strand
  // anyone who bookmarked it.
  if (hasAiConsent(user)) redirect(destination);

  return (
    <main className="billing-lock-page">
      <div className="billing-lock-shell">
        <NuraLogo />
        <div className="billing-lock-card" role="dialog" aria-labelledby="ai-consent-title" aria-modal="true">
          <span className="billing-lock-icon" aria-hidden="true">
            <ShieldCheck size={22} strokeWidth={2.2} />
          </span>
          <span className="auth-kicker">BEFORE YOU START</span>
          <h1 id="ai-consent-title">Nura sends what you share to an AI model</h1>
          <p>
            To turn what you tell it into Care plans, check-ins and summaries, Nura sends the health context you
            share to <strong>Anthropic</strong>, the company whose Claude models do that writing. Nothing is sent
            until you agree here.
          </p>
          <ul className="billing-lock-benefits">
            <li>
              <MessageSquare size={16} strokeWidth={2.2} /> Messages and Care plan details you write
            </li>
            <li>
              <FileText size={16} strokeWidth={2.2} /> Notes, documents and images you attach
            </li>
            <li>
              <Mic size={16} strokeWidth={2.2} /> Voice notes, transcribed first by ElevenLabs
            </li>
          </ul>
          <p>
            Anthropic processes it only to generate your reply and may not use it to train its models or for its
            own purposes. Nura never sells your health context or uses it for advertising. Read{" "}
            <Link href="/data-use">how your data is used</Link> and our{" "}
            <Link href="/privacy">privacy policy</Link>, or delete everything at any time from Me → Data &amp; export.
          </p>
          <AiConsentActions next={destination} />
          <SignOutButton className="skip-intake-button billing-lock-signout" source="ai_consent" />
        </div>
      </div>
    </main>
  );
}
