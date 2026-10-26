import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { WebOnly } from "@/components/web-only";
import { FREE_DOCUMENT_LIMIT } from "@/lib/billing/subscription";
import { APP_STORE_URL, GUIDE_APP_HREF, GUIDE_PLAY_HREF } from "@/lib/content/guide-links";

// Pieces every /guides/[slug] page shares, whichever list the guide comes from.

export function GuideCta({ prompt }: { prompt: string }) {
  return (
    <section className="guide-cta" aria-label="Try Clariti">
      <p>{prompt}</p>
      <div className="guide-cta-actions">
        <Link className="guide-cta-primary" href={GUIDE_APP_HREF}>
          Explain my document <ArrowRight aria-hidden="true" />
        </Link>
        <Link href="/example">See an example analysis first</Link>
      </div>
      <WebOnly>
        <p className="guide-cta-note">
          Your first {FREE_DOCUMENT_LIMIT} analyses are free. Also on <a href={GUIDE_PLAY_HREF}>Android</a> and{" "}
          <a href={APP_STORE_URL}>iPhone</a>.
        </p>
      </WebOnly>
    </section>
  );
}

export function GuideFoot({ invented }: { invented: boolean }) {
  return (
    <footer className="guide-foot">
      General information, not medical or financial advice.{invented ? " The examples on this page are invented." : ""}{" "}
      Clariti explains paperwork in plain language; it does not diagnose or replace advice from your doctor, pharmacist
      or insurer.
    </footer>
  );
}
