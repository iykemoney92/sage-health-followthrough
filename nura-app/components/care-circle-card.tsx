"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, Check, Copy, Link2, MessageCircle, Users, X } from "lucide-react";
import type { CircleMember } from "@/lib/care-circle";

type Invite = { url: string; whatsappUrl: string; expiresAt: string };

/**
 * Owner-side Care circle: who can see this plan, one-tap removal, and minting an invite link.
 * Removal is final the moment the request returns - the row is revoked in Postgres and every
 * policy that let that person read the plan stops matching.
 */
export function CareCircleCard({
  planId,
  initialMembers,
  initialAlertMissed = false,
}: {
  planId: string;
  initialMembers: CircleMember[];
  initialAlertMissed?: boolean;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [alertMissed, setAlertMissed] = useState(initialAlertMissed);
  const [savingAlert, setSavingAlert] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [creating, setCreating] = useState(false);
  const [needsPlus, setNeedsPlus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function remove(memberId: string) {
    if (removing) return;
    setRemoving(memberId);
    setError("");
    try {
      const res = await fetch(`/api/plans/${planId}/circle/${memberId}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError("Couldn't remove them just now. Please try again.");
        return;
      }
      setMembers((prev) => prev.filter((member) => member.memberId !== memberId));
    } catch {
      setError("Couldn't remove them just now. Please try again.");
    } finally {
      setRemoving(null);
    }
  }

  async function createInviteLink() {
    if (creating) return;
    setCreating(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch(`/api/plans/${planId}/circle/invites`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.status === 402) {
        setNeedsPlus(true);
        return;
      }
      if (!res.ok || !data?.ok) {
        setError("Couldn't create an invite link just now. Please try again.");
        return;
      }
      setInvite({ url: data.url, whatsappUrl: data.whatsappUrl, expiresAt: data.expiresAt });
    } catch {
      setError("Couldn't create an invite link just now. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleAlert(next: boolean) {
    if (savingAlert) return;
    setSavingAlert(true);
    setError("");
    const previous = alertMissed;
    setAlertMissed(next);
    try {
      const res = await fetch(`/api/plans/${planId}/circle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertMissed: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setAlertMissed(previous);
        setError("Couldn't save that just now. Please try again.");
      }
    } catch {
      setAlertMissed(previous);
      setError("Couldn't save that just now. Please try again.");
    } finally {
      setSavingAlert(false);
    }
  }

  async function copyLink() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy - long-press the link to copy it instead.");
    }
  }

  return (
    <section className="detail-card care-circle-card" aria-label="Care circle">
      <h3>
        <Users aria-hidden /> Care circle
      </h3>
      <p className="care-circle-intro">
        People you invite can see this Care plan, its roadmap and check-ins. They can never see your conversation with Nura.
      </p>

      {members.length > 0 ? (
        <ul className="care-circle-list">
          {members.map((member) => (
            <li key={member.memberId}>
              <span className="care-circle-avatar" aria-hidden="true">
                {member.displayName.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="care-circle-who">
                <b>{member.displayName}</b>
                {member.email && <small>{member.email}</small>}
              </span>
              <button
                type="button"
                className="care-circle-remove"
                aria-label={`Remove ${member.displayName} from this Care plan`}
                onClick={() => remove(member.memberId)}
                disabled={removing === member.memberId}
              >
                <X /> {removing === member.memberId ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="care-circle-empty">Only you can see this Care plan right now.</p>
      )}

      {needsPlus ? (
        <div className="care-circle-invite care-circle-upsell">
          <b>Sharing a Care plan is part of Nura Plus.</b>
          <span>The person you invite never pays - Plus is only needed on your side to share.</span>
          <Link href="/billing" className="primary-cta">
            See Nura Plus
          </Link>
        </div>
      ) : invite ? (
        <div className="care-circle-invite">
          <label>
            <span>Invite link</span>
            <input type="text" readOnly value={invite.url} onFocus={(event) => event.currentTarget.select()} />
          </label>
          <div className="button-row">
            <a href={invite.whatsappUrl} target="_blank" rel="noopener noreferrer" className="primary-cta">
              <MessageCircle /> Share on WhatsApp
            </a>
            <button type="button" className="secondary-cta" onClick={copyLink}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <small>This link works for one person and expires in 7 days. You can remove them at any time.</small>
        </div>
      ) : (
        <button type="button" className="care-circle-invite-button secondary-cta" onClick={createInviteLink} disabled={creating}>
          <Link2 /> {creating ? "Creating link…" : "Invite someone"}
        </button>
      )}

      <label className="care-circle-toggle">
        <input
          type="checkbox"
          checked={alertMissed}
          disabled={savingAlert}
          onChange={(event) => void toggleAlert(event.target.checked)}
        />
        <span className="care-circle-toggle-text">
          <b>
            <BellRing aria-hidden /> Tell my circle if I miss a check-in
          </b>
          <small>
            If a check-in is still not done a day later, the people here get a gentle nudge. Off unless you switch it on.
          </small>
        </span>
      </label>

      {error && <p className="care-circle-error">{error}</p>}
    </section>
  );
}
