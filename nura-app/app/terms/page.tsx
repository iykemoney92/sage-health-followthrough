import { LegalPage } from "../legal-content";

const sections = [
  {
    title: "What Nura is",
    body: "Nura is a conversation-first health memory and follow-through companion. It helps organise what you share into Threads, prepare check-ins, reminders and summaries, and continue conversations through supported channels.",
  },
  {
    title: "What Nura is not",
    body: "Nura is not a medical device, clinician, emergency service, diagnosis tool, prescribing tool, or replacement for professional care. It supports follow-through and reflection, not clinical decision-making.",
  },
  {
    title: "User responsibility",
    body: "You are responsible for deciding what to share, checking important details, and contacting a qualified professional for medical advice. Do not rely on Nura for emergencies or urgent symptoms.",
  },
  {
    title: "Demo status",
    body: "This version is a hackathon MVP. Some integrations, templates and follow-up flows may be configured for demonstration and should be reviewed before any real-world healthcare deployment.",
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="TERMS"
      title="Simple terms for a focused demo."
      intro="These terms explain the intended use and limits of Nura during the hackathon MVP."
      sections={sections}
    />
  );
}
