import { LegalPage } from "../legal-content";

const sections = [
  {
    title: "Data Nura uses",
    body: "Nura uses account details, profile preferences, messages, attachments, Care plan context, check-in responses, reminders, and summaries — the context needed to help you follow through between appointments.",
  },
  {
    title: "Why Nura uses it",
    body: "That context is used to keep related details in one Care plan, schedule useful check-ins, prepare summaries, and keep supported channels (in-app, WhatsApp, voice) aligned with the same Care plan.",
  },
  {
    title: "Attachments and media",
    body: "Images, files, documents, and voice notes are treated as context for the relevant Care plan. Nura keeps media within what you shared or confirmed — it does not invent clinical advice from documents alone.",
  },
  {
    title: "What we don’t do with it",
    body: "We don’t sell your health context. We don’t use it for advertising. Providers that help run Nura only receive what they need for their function, and may not use your health context for their own purposes.",
  },
  {
    title: "Retention and deletion",
    body: "Retention is under your control. From Me → Data & export you can download a complete copy of your health memory, or permanently delete your account and associated data. Both take effect immediately and cannot be undone.",
  },
];

export default function DataUsePage() {
  return (
    <LegalPage
      active="data-use"
      eyebrow="Data use"
      title="How Nura uses what you share."
      intro="Nura only uses shared context to organise Care plans and follow up — so health advice doesn’t disappear after the visit."
      sections={sections}
    />
  );
}
