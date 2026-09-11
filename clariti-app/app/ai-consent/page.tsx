import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, ScanLine, ShieldCheck } from "lucide-react";
import { AiConsentActions } from "@/components/ai-consent-actions";
import { SignOutButton } from "@/components/sign-out-button";
import { hasAiConsent } from "@/lib/ai-consent";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { safeNextPath } from "@/lib/auth/safe-path";

/**
 * The consent gate. `proxy.ts` sends every signed-in user here until they agree,
 * and the upload screen routes here rather than posting a picked file, so
 * nothing reaches the model ahead of it.
 */
export default async function AiConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  const { next } = await searchParams;
  const destination = safeNextPath(next, "") || "/";

  // Already agreed: nothing to ask, and leaving the gate reachable would strand
  // anyone who bookmarked it.
  if (hasAiConsent(user)) redirect(destination);

  return (
    <main className="billing-lock-page">
      <div className="billing-lock-shell">
        <span className="clariti-brand"><span className="clariti-mark">C</span><strong>Clariti</strong></span>
        <div className="billing-lock-card" role="dialog" aria-labelledby="ai-consent-title" aria-modal="true">
          <span className="billing-lock-icon" aria-hidden="true">
            <ShieldCheck size={22} strokeWidth={2.2} />
          </span>
          <span className="clariti-kicker">BEFORE YOU START</span>
          <h1 id="ai-consent-title">Clariti sends your documents to an AI model</h1>
          <p>
            To explain a bill or a lab result in plain English, Clariti sends that document and your questions to{" "}
            <strong>Anthropic</strong>, whose Claude models write the explanation, reached either directly or
            through the <strong>Vercel AI Gateway</strong>. Nothing is sent until you agree here.
          </p>
          <ul className="billing-lock-benefits">
            <li>
              <FileText size={16} strokeWidth={2.2} /> The documents you upload, including the amounts and codes on them
            </li>
            <li>
              <ScanLine size={16} strokeWidth={2.2} /> Page images when a PDF has no readable text
            </li>
          </ul>
          <p>
            They process it only to produce your explanation, and may not use it to train their models or for their
            own purposes. Clariti never sells your documents or uses them for advertising. Read our{" "}
            <Link href="/privacy">privacy policy</Link>, or delete everything at any time from Settings.
          </p>
          <AiConsentActions next={destination} />
          <SignOutButton className="skip-intake-button billing-lock-signout" />
        </div>
      </div>
    </main>
  );
}
