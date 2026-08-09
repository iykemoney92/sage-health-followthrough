import { LegalPage } from "../legal-content";

function buildSections(supportEmail: string) {
  return [
    {
      title: "What Nura remembers",
      body: "Nura remembers the health context you choose to share so follow-through doesn’t slip between appointments: account and profile details, messages, Care plans, check-ins, reminders, uploaded notes, voice-note transcripts, images, documents, and summaries.",
    },
    {
      title: "Who else processes your data",
      body: "Nura uses a small set of providers to operate: Supabase (database, authentication, and storage), Anthropic (models that help organise shared context), ElevenLabs (voice check-ins and transcription), Twilio and Meta’s WhatsApp Business Platform (calls and WhatsApp delivery), RevenueCat and Stripe (billing), Vercel (hosting), and — if you accept analytics cookies — Google Analytics (aggregated product usage). Each only receives what it needs for that job, and none may use your health context for their own purposes.",
    },
    {
      title: "Your channels",
      body: "If you connect WhatsApp, Nura uses your phone number and link code to associate WhatsApp messages with your account. In-app messages, WhatsApp messages, and voice check-ins can update the same Care plans.",
    },
    {
      title: "Your control",
      body: "You decide what Nura remembers. You can edit your profile, change follow-up preferences, review summaries, or ask Nura to stop remembering specific context. From Me → Data & export you can download a full copy of your data, or permanently delete your account — both take effect immediately.",
    },
    {
      title: "Your rights",
      body: "Depending on where you live, you may have rights to access, correct, delete, or receive a portable copy of your data, and to object to or restrict certain processing. Export and delete in account settings cover most of these; for anything else, contact us below.",
    },
    {
      title: "Retention",
      body: "We keep your data while your account is active, or until you delete it. Deleting your account permanently removes your Care plans, messages, check-ins, and uploaded content from our systems.",
    },
    {
      title: "Cookies",
      body: "Nura uses essential cookies to keep you signed in and your session secure. With your consent, we also use Google Analytics cookies to understand how people use Nura (pages visited, device type, and similar usage signals). These are not used for advertising. You can choose Essential only or Accept when the cookie notice appears.",
    },
    {
      title: "Age requirement",
      body: "Nura is intended for adults. It is not directed at, and should not be used by, children under 16.",
    },
    {
      title: "Safety boundary",
      body: "Nura organises and follows up. It does not diagnose, prescribe, replace a clinician, or handle emergencies. If something may be urgent, contact emergency or urgent-care services directly.",
    },
    {
      title: "Contact us",
      body: `Questions about this policy or your data — including export, correction, or deletion beyond account settings — can be sent to ${supportEmail}.`,
    },
  ];
}

export default function PrivacyPage() {
  const supportEmail = process.env.SUPPORT_EMAIL || "support@usenura.app";
  return (
    <LegalPage
      active="privacy"
      eyebrow="Privacy"
      title="Your health context stays yours."
      intro="Nura helps care continue between appointments. It only uses the context you choose to share — and you stay in control of what it remembers."
      sections={buildSections(supportEmail)}
    />
  );
}
