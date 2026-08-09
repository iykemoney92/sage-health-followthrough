"use client";

import {
  CheckCircle2,
  Files,
  MessageCircleQuestion,
  PhoneCall,
  Sparkles,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ClaritiShell } from "@/components/clariti-shell";
import "./billing.css";

type AccessState = {
  hasPlus: boolean;
  status: "free" | "trialing" | "active" | "grace_period" | "cancelled" | "expired";
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  documentsAnalyzedCount: number;
  videosGeneratedCount: number;
  freeDocumentLimit: number;
  freeVideoLimit: number;
};

const DEFAULT_ACCESS: AccessState = {
  hasPlus: false,
  status: "free",
  trialEndsAt: null,
  currentPeriodEndsAt: null,
  documentsAnalyzedCount: 0,
  videosGeneratedCount: 0,
  freeDocumentLimit: 3,
  freeVideoLimit: 1,
};

const FEATURES = [
  { Icon: Files, title: "Unlimited document analyses", copy: "Bills, EOBs, labs, scans, discharge notes — no monthly cap." },
  { Icon: Video, title: "Unlimited explainer videos", copy: "Turn any saved analysis into a plain-language walkthrough video." },
  { Icon: MessageCircleQuestion, title: "Compare documents over time", copy: "See what changed between two lab results, bills, or scans." },
  { Icon: PhoneCall, title: "Email check-ins", copy: "Clariti emails you later to ask if anything changed or needs further analysis." },
];

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingPageContent />
    </Suspense>
  );
}

function BillingPageContent() {
  const searchParams = useSearchParams();
  const [access, setAccess] = useState<AccessState>(DEFAULT_ACCESS);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [authResponse, accessResponse] = await Promise.all([
          fetch("/api/auth/status", { cache: "no-store" }),
          fetch("/api/billing/access", { cache: "no-store" }),
        ]);
        const authPayload = await authResponse.json().catch(() => null);
        if (!alive) return;
        setAuthenticated(Boolean(authPayload?.authenticated));

        if (accessResponse.ok) {
          const payload = await accessResponse.json();
          if (alive && payload?.ok) {
            setAccess({
              hasPlus: Boolean(payload.hasPlus),
              status: payload.status ?? "free",
              trialEndsAt: payload.trialEndsAt ?? null,
              currentPeriodEndsAt: payload.currentPeriodEndsAt ?? null,
              documentsAnalyzedCount: payload.documentsAnalyzedCount ?? 0,
              videosGeneratedCount: payload.videosGeneratedCount ?? 0,
              freeDocumentLimit: payload.freeDocumentLimit ?? 3,
              freeVideoLimit: payload.freeVideoLimit ?? 1,
            });
          }
        }
      } catch {
        if (alive) setAuthenticated(false);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const trialEnds = formatDate(access.trialEndsAt);
  const paidUntil = formatDate(access.currentPeriodEndsAt);
  const isTrialing = access.status === "trialing" && Boolean(trialEnds);
  const statusLabel = access.hasPlus
    ? isTrialing
      ? "Trial active"
      : access.status === "cancelled"
        ? "Cancelling"
        : "Plus active"
    : access.status === "expired"
      ? "Trial expired"
      : "Free";
  const statusCopy = useMemo(() => {
    if (isTrialing && trialEnds) return `Your free trial runs until ${trialEnds}.`;
    if (access.status === "cancelled" && paidUntil) return `Cancelled — Plus stays on until ${paidUntil}.`;
    if (access.hasPlus && paidUntil) return `Your Plus access renews on ${paidUntil}.`;
    if (access.status === "expired") return "Your trial has ended. Upgrade to keep unlimited access.";
    return `You get ${access.freeDocumentLimit} free document analyses and ${access.freeVideoLimit} free explainer video before Plus is required.`;
  }, [access, isTrialing, paidUntil, trialEnds]);

  const checkoutNotice = searchParams.get("checkout");
  const remainingDocs = Math.max(0, access.freeDocumentLimit - access.documentsAnalyzedCount);
  const remainingVideos = Math.max(0, access.freeVideoLimit - access.videosGeneratedCount);

  return (
    <ClaritiShell>
      <main className="clariti-billing-page">
        <header className="billing-hero">
          <p className="clariti-kicker">CLARITI PLUS</p>
          <h1>Understand every document, not just the first few</h1>
          <p className="billing-hero-copy">
            Clariti Plus unlocks unlimited document analyses, explainer videos, email check-ins, and the ability to
            compare documents over time — so you always know what changed.
          </p>
        </header>

        {checkoutNotice === "failed" || checkoutNotice === "profile-update-failed" ? (
          <div className="billing-alert">Checkout did not complete. Please try again.</div>
        ) : checkoutNotice === "use-page" ? (
          <div className="billing-alert">
            Plus checkout needs a RevenueCat Web Purchase Link. Billing is configured through RevenueCat, not Stripe Checkout.
          </div>
        ) : null}

        <section className="billing-status-card">
          <div className="billing-status-copy">
            <small>Current plan</small>
            <div className="billing-status-title-row">
              <h2>{loading ? "Checking your account..." : statusLabel}</h2>
              <span className={`billing-status-pill ${access.hasPlus ? "is-on" : "is-off"}`}>
                {access.hasPlus ? "Plus" : "Free"}
              </span>
            </div>
            <p>{loading ? "One moment." : statusCopy}</p>
            {!loading && !access.hasPlus ? (
              <div className="billing-usage-row">
                <span>{remainingDocs} of {access.freeDocumentLimit} free document analyses left</span>
                <span>{remainingVideos} of {access.freeVideoLimit} free explainer video left</span>
              </div>
            ) : null}
          </div>

          <div className="billing-actions">
            {access.hasPlus ? (
              <span className="billing-active-note"><CheckCircle2 /> Plus is active on this account.</span>
            ) : authenticated ? (
              <a href="/api/billing/checkout" className="billing-primary-cta">
                <Sparkles /> Start Clariti Plus
              </a>
            ) : (
              <Link href="/" className="billing-primary-cta">
                Sign in to start Plus
              </Link>
            )}
          </div>
        </section>

        <section className="billing-features">
          <h3>Included with Plus</h3>
          <div className="billing-feature-grid">
            {FEATURES.map(({ Icon, title, copy }) => (
              <article key={title} className="billing-feature-card">
                <span className="billing-feature-icon"><Icon /></span>
                <div>
                  <b>{title}</b>
                  <p>{copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="billing-plans">
          <article className="billing-plan-card">
            <span className="billing-plan-eyebrow">MONTHLY</span>
            <b>Clariti Plus</b>
            <p>Billed monthly. Cancel anytime from your purchase confirmation.</p>
          </article>
          <article className="billing-plan-card billing-plan-annual">
            <span className="billing-plan-eyebrow">ANNUAL</span>
            <b>Clariti Plus</b>
            <p>Best value — billed once a year.</p>
          </article>
        </section>

        <p className="billing-footnote">
          Clariti explains documents and paperwork. It does not diagnose, prescribe, or make final coverage or
          payment decisions — always confirm important details with your clinician, insurer, or billing office.
        </p>
      </main>
    </ClaritiShell>
  );
}
