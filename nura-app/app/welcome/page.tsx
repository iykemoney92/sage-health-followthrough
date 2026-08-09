import { NuraLogo } from "@/components/nura-logo";
import { TrackedLink } from "@/components/tracked-link";
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
            <TrackedLink
              href="/signup"
              className="primary-cta onboarding-primary"
              event="welcome_cta_click"
              eventParams={{ cta: "get_started" }}
            >
              Get started
            </TrackedLink>
            <TrackedLink
              href="/login"
              className="welcome-login"
              event="welcome_cta_click"
              eventParams={{ cta: "sign_in" }}
            >
              Sign in
            </TrackedLink>
          </div>
        </div>
      </section>
    </main>
  );
}
