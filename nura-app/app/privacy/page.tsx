import { LegalPage } from "../legal-content";

function buildSections(supportEmail: string) { return [
  {
    title: "What Nura remembers",
    body: "Nura remembers the health context you choose to share: account and profile details, messages, Threads, check-ins, reminders, uploaded notes, voice-note transcripts, images, documents, and summaries. This is used to keep follow-through organised between appointments.",
  },
  {
    title: "Who else processes your data",
    body: "Nura relies on a small set of service providers to work: Supabase (database, authentication and storage), Anthropic (the Claude models that read and organise your shared context), ElevenLabs (voice check-in calls and voice-note transcription), Twilio and Meta's WhatsApp Business Platform (delivering calls and WhatsApp messages), RevenueCat and Stripe (subscription billing), and Vercel (hosting). Each only receives the data needed to perform its function, and none are permitted to use your health context for their own purposes.",
  },
  {
    title: "Your channels",
    body: "If you connect WhatsApp, Nura uses your phone number and link code to associate WhatsApp messages with your Nura account. In-app messages, WhatsApp messages, and voice check-in calls can all update the same Threads.",
  },
  {
    title: "Your control",
    body: "You can edit your profile, change follow-up preferences, review summaries, or ask Nura to stop remembering specific context. From Me → Data & export you can download a complete copy of everything Nura has stored for your account, or permanently delete your account and all associated data at any time - both take effect immediately.",
  },
  {
    title: "Your rights",
    body: "Depending on where you live, you may have rights to access, correct, delete, or receive a portable copy of your data, and to object to or restrict certain processing. The export and delete tools in your account settings cover most of these directly; for anything else, contact us using the details below.",
  },
  {
    title: "Retention",
    body: "We keep your data for as long as your account is active, or until you delete it. Deleting your account permanently removes your Threads, messages, check-ins, and uploaded content from our systems.",
  },
  {
    title: "Cookies",
    body: "Nura uses only essential cookies required to keep you signed in and your session secure. We do not use advertising or third-party tracking cookies.",
  },
  {
    title: "Age requirement",
    body: "Nura is intended for use by adults. It is not directed at, and should not be used by, children under 16.",
  },
  {
    title: "Safety boundary",
    body: "Nura organises and follows up. It does not diagnose, prescribe, replace a clinician, or handle emergencies. If something may be urgent, contact emergency or urgent-care services directly rather than waiting for Nura.",
  },
  {
    title: "Contact us",
    body: `Questions about this policy or your data - including export, correction, or deletion requests beyond what's available in your account settings - can be sent to ${supportEmail}.`,
  },
]; }

export default function PrivacyPage() {
  const supportEmail = process.env.SUPPORT_EMAIL || "support@nura.app";
  return (
    <LegalPage
      eyebrow="PRIVACY"
      title="Your health context belongs to you."
      intro="Nura is built to help people remember, organise and follow through on care context while keeping control clear."
      sections={buildSections(supportEmail)}
    />
  );
}
