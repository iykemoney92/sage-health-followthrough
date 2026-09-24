import Link from "next/link";
import { Users } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { JoinCircleActions } from "@/components/join-circle-actions";
import { previewInvite } from "@/lib/care-circle-admin";
import { getSessionUser } from "@/lib/integrations/supabase-server";

export const dynamic = "force-dynamic";

/**
 * Landing page for an invite link. Public on purpose: the link itself is the secret, and a
 * visitor without an account needs to understand what they're joining before creating one.
 * Nothing here reveals more than the link already implies - whose plan and what it's called.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, user] = await Promise.all([previewInvite(token), getSessionUser()]);

  const heading =
    preview.status === "valid"
      ? `${preview.ownerName} wants you in their Care circle`
      : preview.status === "used"
        ? "This invite has already been used"
        : preview.status === "expired"
          ? "This invite has expired"
          : "This invite link isn't valid";

  const body =
    preview.status === "valid"
      ? `You'd be able to see how "${preview.planTitle}" is going — the plan, its roadmap and check-ins — so you can support ${preview.ownerName}. Their conversation with Nura stays private to them.`
      : preview.status === "used"
        ? `Invite links work for one person. If that was you, you can open "${preview.planTitle}" from your Care plans. Otherwise ask ${preview.ownerName} for a new link.`
        : preview.status === "expired"
          ? `Links last seven days. Ask ${preview.ownerName} to send you a new one.`
          : "Check the link you were sent, or ask the person who shared it for a fresh one.";

  return (
    <main className="join-page">
      <header className="join-brand">
        <NuraLogo compact href="/" />
      </header>
      <section className="join-card">
        <span className="join-icon" aria-hidden="true">
          <Users />
        </span>
        <span className="auth-kicker">CARE CIRCLE</span>
        <h1>{heading}</h1>
        <p>{body}</p>
        <JoinCircleActions
          token={token}
          status={preview.status}
          signedIn={Boolean(user)}
          isOwner={preview.status === "valid" && Boolean(user) && preview.ownerId === user!.id}
          alreadyMine={preview.status === "used" && Boolean(user) && preview.acceptedBy === user!.id}
          planId={preview.status === "valid" || preview.status === "used" ? preview.planId : null}
          ownerName={preview.status === "invalid" ? "" : preview.ownerName}
        />
        <p className="join-footnote">
          Nura is a follow-through companion, not a medical service. Read how{" "}
          <Link href="/data-use">data is used</Link> and the <Link href="/privacy">privacy policy</Link>.
        </p>
      </section>
    </main>
  );
}
