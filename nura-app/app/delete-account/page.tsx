import type { Metadata } from "next";
import { LegalPage } from "../legal-content";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "How to permanently delete your Nura account and everything it holds, from inside the app or by email.",
};

function buildSections(supportEmail: string) {
  return [
    {
      title: "Delete from inside the app",
      body: "Sign in, open Me, then Data & export, and choose Delete account. Confirm once and the deletion runs immediately — there is no waiting period and no way to undo it.",
    },
    {
      title: "Delete by email",
      body: `If you can no longer sign in, email ${supportEmail} from the address on the account with the subject "Delete my account". We verify that the request comes from the account holder and delete the account within 30 days.`,
    },
    {
      title: "What is deleted",
      body: "Everything Nura holds for you: your profile and sign-in, Care plans and their steps, check-ins and reminders, messages and voice-note transcripts, uploaded notes, images and documents, appointment summaries, connected channels such as WhatsApp, and push-notification registrations.",
    },
    {
      title: "What is kept, and for how long",
      body: "If you subscribed to Nura Plus, the payment processor (Apple, Google, Stripe or RevenueCat) keeps the transaction record it is legally required to hold; it contains no health context. Server logs that may reference your account id expire within 30 days. Nothing else is retained.",
    },
    {
      title: "Delete some data without deleting the account",
      body: "You can delete individual Care plans, messages and uploads at any time from inside Nura, and ask Nura to stop remembering specific context from Me → Data & export.",
    },
  ];
}

export default function DeleteAccountPage() {
  const supportEmail = process.env.SUPPORT_EMAIL || "support@usenura.app";
  return (
    <LegalPage
      active="privacy"
      eyebrow="Your account"
      title="Delete your Nura account."
      intro="Deleting your account removes everything Nura remembers about you, immediately and permanently. Here is how to do it, and exactly what happens when you do."
      sections={buildSections(supportEmail)}
    />
  );
}
