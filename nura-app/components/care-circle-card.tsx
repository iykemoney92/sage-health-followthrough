"use client";

import { useState } from "react";
import { Users, X } from "lucide-react";
import type { CircleMember } from "@/lib/care-circle";

/**
 * Owner-side view of who is watching a Care plan, with one-tap removal. Removal is final the
 * moment the request returns: the row is revoked in Postgres and every policy that let that
 * person read the plan stops matching.
 */
export function CareCircleCard({ planId, initialMembers }: { planId: string; initialMembers: CircleMember[] }) {
  const [members, setMembers] = useState(initialMembers);
  const [removing, setRemoving] = useState<string | null>(null);
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

  if (members.length === 0) return null;

  return (
    <section className="detail-card care-circle-card" aria-label="Care circle">
      <h3>
        <Users aria-hidden /> Care circle
      </h3>
      <p className="care-circle-intro">
        These people can see this Care plan and its check-ins. They can never see your conversation with Nura.
      </p>
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
      {error && <p className="care-circle-error">{error}</p>}
    </section>
  );
}
