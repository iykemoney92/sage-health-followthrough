import { CookieChoiceButton } from "@/components/cookie-choice-button";
import { LegalPage } from "../legal-content";

function buildSections(supportEmail: string) {
  return [
    {
      title: "What Nura remembers",
      body: "Nura remembers the health context you choose to share so follow-through doesn’t slip between appointments: account and profile details, messages, Care plans, check-ins, reminders, uploaded notes, voice-note transcripts, images, documents, and summaries.",
    },
    {
      title: "Who else processes your data",
      body: "Nura uses a small set of providers to operate: Supabase (database, authentication, and storage), Anthropic (models that help organise shared context), ElevenLabs (voice check-ins and transcription), Twilio and Meta’s WhatsApp Business Platform (calls and WhatsApp delivery), RevenueCat and Stripe (billing), Vercel (hosting), and — if you accept cookies — Google Analytics (aggregated product usage), PostHog (product analytics and session recordings, hosted in the EU), the Quora Pixel and the Meta Pixel on our public web pages (ad measurement), and, in the Android app, Google Analytics for Firebase (see Cookies). Each only receives what it needs for that job, and none may use your health context for their own purposes.",
    },
    {
      title: "Apple Health and Health Connect",
      body: "Only if you choose to connect it in the Nura app (Me → Connections), Nura reads five types of data from Apple Health (HealthKit) on iPhone or Health Connect on Android: steps, sleep, resting heart rate, weight and blood pressure. Nura only reads — it never writes to Apple Health or Health Connect — and you choose which types to allow. Nura stores a daily summary of each (for example total sleep for a night, not every reading) for up to 90 days. When it prepares one of your check-ins, a short summary of what has changed is sent to Anthropic, which writes Nura’s messages, and during voice calls to ElevenLabs, which runs the call; both process it only to provide your check-in and may not use it to train models or for any other purpose. Nura may start a gentle check-in when your shared sleep or activity has dropped well below your usual level. This data is never shown to your Care circle, never used in calls to someone you care for, never included in notifications or WhatsApp messages, never used for advertising, marketing or analytics, never sold, and never stored in iCloud. Disconnecting in Me → Connections deletes everything Nura stored from it straight away; you can also remove Nura’s access in the Health app or in Health Connect settings.",
    },
    {
      title: "Your channels",
      body: "If you connect WhatsApp, Nura uses your phone number and link code to associate WhatsApp messages with your account. In-app messages, WhatsApp messages, and voice check-ins can update the same Care plans.",
    },
    {
      title: "Your Care circle",
      body: "You can invite family, a friend or a carer to keep an eye on a specific Care plan. Someone you invite sees that plan’s title, notes, roadmap and check-in status — never your conversation with Nura, your uploaded documents, your phone number or anything from other Care plans. Invites are single-use links that expire after seven days, and you can remove anyone from a Care plan at any moment, which takes effect immediately. Nura also writes your circle a short update from that same plan information, which you can always read yourself, and — only if you switch it on for a plan — tells them when a scheduled check-in is still not done a day later. These updates reach your circle in the app, by push notification and by email, and each person can turn email off. If you choose to pass something on — by typing it on the plan, or by saying yes when Nura asks at the end of a call and reads your message back — your circle sees exactly those words and nothing else from the call. You can take a message back at any time.",
    },
    {
      title: "Someone you care for",
      body: `A Care plan can be about someone else, such as a parent, so that Nura's check-in calls go to them instead of you. Nura only calls them after they agree — by tapping Yes on a link you send them, or by you confirming they agree on their behalf, which you should only do if they know about Nura and are happy to be called. For that person we keep their first name, how they're related to you, their phone number, their time zone, and a record of their agreement. Calls happen in their daytime, may be recorded and transcribed so Nura can keep track of what was said, and a short summary of each call is shared with you. Nothing you tell Nura privately is read out to them. They can say "stop" on any call, or use their link, and the calls end straight away; you can stop them too. They can also ask us to delete their details at ${supportEmail}.`,
    },
    {
      title: "Invite links",
      body: "You have a personal link you can share to invite friends to Nura. When someone creates an account through it, we record that they joined through your link so their free Plus can be switched on. The link and the message that goes with it say nothing about your health, and someone who opens it only sees your first name. You only ever see how many people have joined through your link, never who they are. These records are deleted with either account.",
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
      body: "Nura uses essential cookies to keep you signed in and your session secure. With your consent, we also use Google Analytics cookies to understand how people use Nura (pages visited, device type, and similar usage signals). Google Analytics on the web is not used for advertising. Also on the web, Accept turns on the Quora Pixel, which tells Quora when you visit a public page of this site (the home page, sign-up and these policy pages), tap an App Store, Google Play or Get started button, or create an account on the web, so Quora can match those visits to people who saw our ads and we can tell which ads are worth running. It sets Quora's own cookies and sends Quora the page address, your browser and device details and your IP address; it never runs on signed-in pages or inside the Nura apps, and never receives your health information. Nothing is sent to Quora unless you press Accept, wherever you live. Accept also turns on the Meta Pixel, which tells Meta (Facebook and Instagram) the same three things: a visit to a public page, a tap on an App Store, Google Play or Get started button, and an account created on the web. It works under the same limits: it sets Meta's own cookies and sends Meta the page address, your browser and device details and your IP address, never runs on signed-in pages or inside the Nura apps, never receives your health information, and sends nothing unless you press Accept. In the Android app, Accept also lets Firebase tell Google Ads that an install from one of our ads went on to create an account, so we can see which ads work; that signal carries no health information and is never used for ad personalisation or remarketing. With your consent, we also use PostHog, hosted in the EU, to see how Nura is used so we can fix the places where it gets in the way: the pages you open, the buttons you tap, errors, and recordings of the screen while you use Nura. Recordings never include what you type, and on signed-in pages they hide all text, images, audio and video, so they don't show your Care plans, messages, check-ins, medications or documents. Secret links (such as invitation and consent links) are removed from page addresses before they are sent. Once you sign in, PostHog links this to your Nura account ID, never your email. On the web and in the Android app, nothing is sent to PostHog unless you press Accept on a notice that names it. In the iPhone app there is no cookie notice and no Google Analytics, Quora Pixel or ad measurement; PostHog is on as first-party product analytics (never combined with other companies' data, never used for advertising and never sold), and you can turn it off with the Product analytics switch below. PostHog data isn't removed automatically when you delete your account; ask us and we'll delete it. You can choose Essential only or Accept when the cookie notice appears, and change that choice at any time with the button below.",
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
      updated="October 24, 2026"
    >
      <CookieChoiceButton />
    </LegalPage>
  );
}
