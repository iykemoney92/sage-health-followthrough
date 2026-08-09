import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NuraLogo } from "@/components/nura-logo";
import { LandingSprout } from "@/components/landing-sprout";
import { LandingReveal } from "@/components/landing-reveal";
import { LandingReadMore } from "@/components/landing-read-more";
import { LandingNavChrome } from "@/components/landing-nav-chrome";
import { TrackedLink } from "@/components/tracked-link";
import { getSessionUser } from "@/lib/integrations/supabase-server";
import { NURA_PRODUCT } from "@/lib/product/nura-story";
import "./landing.css";

export default async function LandingPage() {
  const user = await getSessionUser();
  const isSignedIn = Boolean(user);

  return (
    <main className="landing-v2">
      <LandingNavChrome>
        <NuraLogo />
        <nav aria-label="Landing">
          <a href="#how">How it works</a>
          <a href="#why">Why Nura</a>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <div className="nav-actions">
          {isSignedIn ? (
            <TrackedLink
              href="/today"
              className="primary-cta"
              event="landing_cta_click"
              eventParams={{ cta: "dashboard", placement: "nav" }}
            >
              Dashboard
            </TrackedLink>
          ) : (
            <>
              <TrackedLink
                href="/login"
                className="text-link"
                event="landing_cta_click"
                eventParams={{ cta: "sign_in", placement: "nav" }}
              >
                Sign in
              </TrackedLink>
              <TrackedLink
                href="/signup"
                className="primary-cta"
                event="landing_cta_click"
                eventParams={{ cta: "get_started", placement: "nav" }}
              >
                Get started
              </TrackedLink>
            </>
          )}
        </div>
      </LandingNavChrome>

      <section className="landing-hero" aria-label="Nura">
        <div className="landing-hero-atmosphere" aria-hidden="true" />
        <div className="landing-hero-copy">
          <p className="landing-hero-brand-word">{NURA_PRODUCT.name}</p>
          <h1>{NURA_PRODUCT.heroHeadline}</h1>
          <p className="landing-hero-support">{NURA_PRODUCT.heroSupport}</p>
          <div className="landing-hero-actions">
            {isSignedIn ? (
              <TrackedLink
                href="/today"
                className="primary-cta large"
                event="landing_cta_click"
                eventParams={{ cta: "dashboard", placement: "hero" }}
              >
                Go to dashboard <ArrowRight size={18} />
              </TrackedLink>
            ) : (
              <TrackedLink
                href="/signup"
                className="primary-cta large"
                event="landing_cta_click"
                eventParams={{ cta: "get_started", placement: "hero" }}
              >
                Get started <ArrowRight size={18} />
              </TrackedLink>
            )}
            <a href="#how" className="secondary-cta large">
              See how it works
            </a>
          </div>
        </div>
        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-hero-stage">
            {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed marketing art */}
            <img
              className="landing-hero-figure"
              src="/illustrations/onboarding-welcome.png"
              alt=""
            />
            <LandingSprout className="landing-hero-sprout" />
          </div>
        </div>
      </section>

      <section id="how" className="landing-section">
        <LandingReveal>
          <span className="landing-section-kicker">How it works</span>
          <h2>One simple loop of care.</h2>
          <p className="landing-section-lead">{NURA_PRODUCT.howItWorksLead}</p>
        </LandingReveal>
        <div className="landing-how-grid">
          {NURA_PRODUCT.howItWorks.map((step, index) => (
            <LandingReveal key={step.title} delayMs={index * 90}>
              <article className="landing-how-step">
                <span className="step-index">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            </LandingReveal>
          ))}
        </div>
      </section>

      <section id="why" className="landing-section landing-why">
        <LandingReveal>
          <span className="landing-section-kicker">Why Nura</span>
          <h2>{NURA_PRODUCT.whyHeadline}</h2>
          <p className="landing-section-lead">{NURA_PRODUCT.whyLead}</p>
        </LandingReveal>
        <LandingReveal delayMs={120}>
          <div className="landing-why-panel" aria-hidden="true">
            <LandingSprout className="landing-why-sprout" />
          </div>
        </LandingReveal>
        <LandingReveal delayMs={180}>
          <LandingReadMore
            className="landing-section-lead landing-why-more"
            text={NURA_PRODUCT.summary}
            previewLength={150}
          />
        </LandingReveal>
      </section>

      <section className="landing-trust">
        <LandingReveal>
          <span className="landing-section-kicker">Private by design</span>
          <h2>Your health context stays yours.</h2>
          <p>{NURA_PRODUCT.trustLead}</p>
          {isSignedIn ? (
            <TrackedLink
              href="/today"
              className="primary-cta large"
              event="landing_cta_click"
              eventParams={{ cta: "dashboard", placement: "trust" }}
            >
              Open your dashboard
            </TrackedLink>
          ) : (
            <TrackedLink
              href="/signup"
              className="primary-cta large"
              event="landing_cta_click"
              eventParams={{ cta: "trust_signup", placement: "trust" }}
            >
              Start with what’s happening today
            </TrackedLink>
          )}
        </LandingReveal>
      </section>

      <footer>
        <div>
          <NuraLogo compact />
          <p>{NURA_PRODUCT.footerLine}</p>
        </div>
        <nav aria-label="Legal links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/data-use">Data use</Link>
        </nav>
        <span>© 2026 Nura</span>
      </footer>
    </main>
  );
}
