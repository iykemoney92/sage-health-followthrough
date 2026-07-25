import { LegalPage } from "../legal-content";

const sections = [
  {
    title: "Data Nura uses",
    body: "Nura uses account details, profile preferences, messages, attachments, Thread context, check-in responses, reminders and summaries to provide memory and follow-through.",
  },
  {
    title: "Why Nura uses it",
    body: "The data is used to connect related context, create or update Threads, schedule useful check-ins, prepare summaries, and keep WhatsApp or in-app conversations aligned with the same health journey.",
  },
  {
    title: "Attachments and media",
    body: "Images, files, documents and voice notes are treated as context for the relevant Thread. Nura should keep media within the chosen context and avoid acting outside what the user has shared or confirmed.",
  },
  {
    title: "Retention and deletion",
    body: "The intended product model is user-controlled retention: users should be able to export or delete their health memory. For the MVP, this page documents the expected data-use posture for the demo.",
  },
];

export default function DataUsePage() {
  return (
    <LegalPage
      eyebrow="DATA USE"
      title="How Nura uses health context."
      intro="Nura uses shared context to make conversations useful, remembered and actionable across check-ins and channels."
      sections={sections}
    />
  );
}
