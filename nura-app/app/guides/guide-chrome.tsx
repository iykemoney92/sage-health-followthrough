import Link from "next/link";
import { NuraLogo } from "@/components/nura-logo";
import { StoreBadges } from "@/components/store-badges";
import { TrackedLink } from "@/components/tracked-link";
import { GUIDE_SIGNUP_HREF } from "@/lib/guides";
import { NURA_PRODUCT } from "@/lib/product/nura-story";
import "./guides.css";

/** Header and footer shared by /guides and every /guides/<slug> page. */
export function GuideChrome({
  children,
  placement,
  signupHref = GUIDE_SIGNUP_HREF,
}: {
  children: React.ReactNode;
  placement: string;
  /** The nav button's tagged link; tool pages pass their own utm_content. */
  signupHref?: string;
}) {
  return (
    <div className="guides-v2">
      <header className="guide-nav">
        <NuraLogo href="/" tagline={false} />
        <nav aria-label="Guides">
          <Link href="/guides" className="is-active">
            Guides
          </Link>
          <Link href="/#how">How Nura works</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <TrackedLink
          href={signupHref}
          className="guide-button"
          event="guide_cta_click"
          eventParams={{ cta: "get_started", placement: `${placement}_nav` }}
        >
          Get started
        </TrackedLink>
      </header>

      {children}

      <footer className="guide-footer">
        <div>
          <NuraLogo compact href="/" />
          <p>{NURA_PRODUCT.footerLine}</p>
          <StoreBadges placement={`${placement}_footer`} compact utmContent="guide" />
          <p className="landing-crisis-line">{NURA_PRODUCT.crisisLine}</p>
        </div>
        <nav aria-label="Site links">
          <Link href="/guides">Guides</Link>
          <Link href="/tools/medicine-schedule">Medicine schedule maker</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/data-use">Data use</Link>
        </nav>
        <span>© 2026 Zapx Solutions Limited. Nura is a product of Zapx Solutions Limited.</span>
      </footer>
    </div>
  );
}

/** Shown on every guide. Health content: no advice, and where to go in an emergency. */
export function GuideDisclaimer() {
  return (
    <p className="guide-disclaimer">
      General information, not medical advice. Nura does not diagnose, prescribe or replace your clinician. In an
      emergency call 999 (UK) or 911 (US); in the UK, NHS 111 can help if you need medical help but it isn&apos;t an
      emergency.
    </p>
  );
}
