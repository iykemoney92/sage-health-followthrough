import type { Metadata } from "next";
import { LANDING_FAQS, LandingAbout } from "@/components/clariti/landing-about";
import { WebOnly } from "@/components/web-only";
import { HomeEntry } from "./home-entry";

export const metadata: Metadata = {
  // Absolute, so the layout's "%s · Clariti" template does not apply to the home page.
  title: { absolute: "Clariti — understand medical bills, EOBs and lab results" },
  alternates: { canonical: "/" },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: LANDING_FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />
      <HomeEntry
        about={
          <WebOnly>
            <LandingAbout />
          </WebOnly>
        }
      />
    </>
  );
}
