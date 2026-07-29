import { LegalPage } from "../legal-content";

function buildSections(supportEmail: string) { return [
  {
    title: "What Nura is",
    body: "Nura is a conversation-first health memory and follow-through companion. It helps organise what you share into Threads, prepare check-ins, reminders and summaries, and continue conversations through supported channels including WhatsApp and voice calls.",
  },
  {
    title: "What Nura is not",
    body: "Nura is not a medical device, clinician, emergency service, diagnosis tool, prescribing tool, or replacement for professional care. It supports follow-through and reflection, not clinical decision-making.",
  },
  {
    title: "Eligibility",
    body: "You must be at least 16 years old to create a Nura account. By using Nura you confirm the information you provide is accurate and that you are authorised to share any health context you submit.",
  },
  {
    title: "User responsibility",
    body: "You are responsible for deciding what to share, checking important details, and contacting a qualified professional for medical advice. Do not rely on Nura for emergencies or urgent symptoms - contact emergency services directly.",
  },
  {
    title: "Nura Plus and billing",
    body: "Nura offers a free tier and a paid Nura Plus subscription with a trial period. Subscriptions are billed and managed through RevenueCat and Stripe; pricing, renewal and cancellation terms are shown at the time of purchase in the app. You can manage or cancel your subscription at any time from Billing in your account settings.",
  },
  {
    title: "Acceptable use",
    body: "Don't use Nura to share content you don't have the right to share, to impersonate someone else, to attempt to disrupt or reverse-engineer the service, or in any way that violates applicable law.",
  },
  {
    title: "Account termination",
    body: "You may delete your account at any time from Me → Data & export, which permanently removes your data. We may suspend or terminate accounts that violate these terms or applicable law.",
  },
  {
    title: "Service changes and availability",
    body: "Nura is an actively developed, early-stage product. Features, integrations and availability may change, and the service is provided \"as is\" without warranty of uninterrupted or error-free operation.",
  },
  {
    title: "Limitation of liability",
    body: "To the fullest extent permitted by law, Nura and its operators are not liable for indirect, incidental, or consequential damages arising from use of the service. Nothing in these terms limits liability that cannot be excluded under applicable law.",
  },
  {
    title: "Contact us",
    body: `Questions about these terms can be sent to ${supportEmail}.`,
  },
]; }

export default function TermsPage() {
  const supportEmail = process.env.SUPPORT_EMAIL || "support@nura.app";
  return (
    <LegalPage
      eyebrow="TERMS"
      title="Simple terms, clearly explained."
      intro="These terms explain the intended use and limits of Nura."
      sections={buildSections(supportEmail)}
    />
  );
}
