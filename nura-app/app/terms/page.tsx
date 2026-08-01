import { LegalPage } from "../legal-content";

function buildSections(supportEmail: string) {
  return [
    {
      title: "What Nura is",
      body:
        "Nura is a health and wellbeing care companion provided by Zapx Solutions Limited. It is built for the time after the appointment — when ongoing care usually sits with the person, family, friends, carers, and community. Tell Nura what’s going on; it keeps a Care plan and checks back in so follow-through doesn’t disappear into busy life. Nura cares within health, medical, and wellbeing bounds; it does not replace clinicians or emergency care.",
    },
    {
      title: "What Nura is not",
      body: "Nura is not a medical device, clinician, emergency service, diagnosis tool, prescribing tool, or replacement for professional care or the people who support you in real life. It supports memory, continuity, and follow-through — not clinical decision-making.",
    },
    {
      title: "Eligibility",
      body: "You must be at least 16 years old to create a Nura account. By using Nura you confirm the information you provide is accurate and that you are authorised to share any health context you submit.",
    },
    {
      title: "User responsibility",
      body: "You decide what to share, check important details, and contact a qualified professional for medical advice. Do not rely on Nura for emergencies or urgent symptoms — contact emergency services directly.",
    },
    {
      title: "Nura Plus and billing",
      body: "Nura offers a free tier and a paid Nura Plus subscription with a trial period. Subscriptions are billed through RevenueCat and Stripe; pricing, renewal, and cancellation terms are shown at purchase. You can manage or cancel anytime from Billing in account settings.",
    },
    {
      title: "Acceptable use",
      body: "Don’t use Nura to share content you don’t have the right to share, to impersonate someone else, to disrupt or reverse-engineer the service, or in any way that violates applicable law.",
    },
    {
      title: "Account termination",
      body: "You may delete your account anytime from Me → Data & export, which permanently removes your data. We may suspend or terminate accounts that violate these terms or applicable law.",
    },
    {
      title: "Service changes and availability",
      body: "Nura is an early-stage product. Features, integrations, and availability may change. The service is provided “as is,” without warranty of uninterrupted or error-free operation.",
    },
    {
      title: "Limitation of liability",
      body: "To the fullest extent permitted by law, Nura and its operators are not liable for indirect, incidental, or consequential damages arising from use of the service. Nothing here limits liability that cannot be excluded under applicable law.",
    },
    {
      title: "Contact us",
      body: `Questions about these terms can be sent to ${supportEmail}.`,
    },
  ];
}

export default function TermsPage() {
  const supportEmail = process.env.SUPPORT_EMAIL || "support@usenura.app";
  return (
    <LegalPage
      active="terms"
      eyebrow="Terms"
      title="Clear terms for care between appointments."
      intro="These terms explain how Nura is meant to be used — care and follow-through after the visit, within health and wellbeing — and the limits that keep clinical decisions with you and your clinicians."
      sections={buildSections(supportEmail)}
    />
  );
}
