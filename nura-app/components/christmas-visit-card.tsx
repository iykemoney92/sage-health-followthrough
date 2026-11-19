"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { track } from "@/lib/analytics";
import { type ChristmasVisitCopy, christmasVisitCopy, christmasVisitDate } from "@/lib/christmas-visit";

const DISMISSED_KEY = "nura.christmasVisit.2026.dismissed";

/**
 * Christmas 2026 on Today (lib/christmas-visit.ts): a nudge to set up a check-in for someone you
 * care for around the Christmas visit. Shown 14 December to 4 January by the browser's own date,
 * to people with no such plan yet; "Not now" hides it on this device for the season.
 */
export function ChristmasVisitCard({ show }: { show: boolean }) {
  const [copy, setCopy] = useState<ChristmasVisitCopy | null>(null);

  useEffect(() => {
    if (!show) return;
    let dismissed = false;
    try {
      dismissed = Boolean(localStorage.getItem(DISMISSED_KEY));
    } catch {
      // Private storage blocked: show it; "Not now" still hides it for this visit.
    }
    const next = dismissed ? null : christmasVisitCopy(christmasVisitDate(window.location.search));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCopy(next);
    if (next) track("christmas_visit_card_shown", { phase: next.phase });
  }, [show]);

  if (!show || !copy) return null;

  function onDismiss() {
    track("christmas_visit_card_dismiss", { phase: copy?.phase });
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Private storage blocked: it may show again next time.
    }
    setCopy(null);
  }

  return (
    <section className="today-push-ask today-christmas-visit" aria-label="Christmas check-in">
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.text}</p>
      </div>
      <div className="today-push-ask-actions">
        <Link className="primary-cta" href="/plans/new?for=someone" onClick={() => track("christmas_visit_card_click", { phase: copy.phase })}>
          <Gift size={16} aria-hidden="true" /> Set up a check-in
        </Link>
        <button type="button" className="today-push-ask-later" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </section>
  );
}
