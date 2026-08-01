import Link from "next/link";

/** Persistent non-diagnostic notice for core product surfaces. */
export function CareDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={compact ? "care-disclaimer compact" : "care-disclaimer"} role="note">
      Nura organises and follows up on what you share — it does not diagnose, prescribe, or replace
      professional care.
      {compact ? (
        <>
          {" "}
          <Link href="/me/support">Support & crisis help</Link>
        </>
      ) : (
        <>
          {" "}
          If you need urgent help, use <Link href="/me/support">Support</Link> for local crisis
          contacts.
        </>
      )}
    </p>
  );
}
