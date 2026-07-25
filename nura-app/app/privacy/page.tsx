import { LegalPage } from "../legal-content";

const sections = [
  {
    title: "What Nura remembers",
    body: "Nura remembers the health context you choose to share: messages, Threads, check-ins, reminders, uploaded notes, voice-note transcripts, images, documents, and summaries. This is used to keep follow-through organised between appointments.",
  },
  {
    title: "Your channels",
    body: "If you connect WhatsApp, Nura uses your phone number and link code to associate WhatsApp messages with your Nura account. In-app messages and WhatsApp messages can update the same Threads.",
  },
  {
    title: "Your control",
    body: "You can edit your profile, change follow-up preferences, review summaries, export your information, or ask Nura to stop remembering specific context. The product is designed around transparent memory rather than hidden tracking.",
  },
  {
    title: "Safety boundary",
    body: "Nura organises and follows up. It does not diagnose, prescribe, replace a clinician, or handle emergencies. If something may be urgent, Nura should direct you to appropriate urgent or emergency care.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="PRIVACY"
      title="Your health context belongs to you."
      intro="Nura is built to help people remember, organise and follow through on care context while keeping control clear."
      sections={sections}
    />
  );
}
