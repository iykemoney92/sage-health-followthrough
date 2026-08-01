import Link from "next/link";
import { NuraLogo } from "@/components/nura-logo";
import { NURA_PRODUCT } from "@/lib/product/nura-story";

// The packaged mobile app (nura-mobile) points its Capacitor shell here
// instead of the marketing "/" — someone who already installed the app from
// a store listing doesn't need the pitch again, just a fast path into an
// account. Signed-in users never see this: middleware.ts redirects it to
// /today alongside /login and /signup.
export default function Welcome() {
  return (
    <main className="onboarding mobile-onboarding step-1">
      <section className="mobile-welcome-screen">
        <div className="welcome-desktop-copy">
          <NuraLogo />
          <span className="auth-kicker">CARE BETWEEN CLINICAL MOMENTS</span>
          <h1>{NURA_PRODUCT.onboardingHeadline}</h1>
          <p>{NURA_PRODUCT.onboardingSupport}</p>
          <div className="welcome-desktop-points">
            <span>Message, voice or upload context</span>
            <span>Builds Care plans from what matters</span>
            <span>Follows up through your preferred channel</span>
          </div>
        </div>
        <div className="mobile-welcome-content">
          <div className="mobile-welcome-brand"><NuraLogo /></div>
          <div className="mobile-welcome-copy">
            <span className="auth-kicker">WELCOME TO NURA</span>
            <h1>{NURA_PRODUCT.heroHeadline}</h1>
            <p>{NURA_PRODUCT.shortSummary}</p>
          </div>
          <div className="mobile-welcome-art" aria-hidden="true">
            <span className="welcome-art-glow" />
            {/* eslint-disable-next-line @next/next/no-img-element -- static welcome illustration, no responsive/CDN sizing needed */}
            <img src="/illustrations/onboarding-welcome.png" alt="" className="welcome-illustration" />
            <span className="welcome-float-chip welcome-float-heart" />
            <span className="welcome-float-chip welcome-float-mic" />
          </div>
          <div className="mobile-welcome-actions">
            <Link href="/signup" className="primary-cta onboarding-primary">Get started</Link>
            <Link href="/login" className="welcome-login">Sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
