/**
 * Questions and answers for /faq. The page and its FAQPage JSON-LD are both built from this list,
 * so the structured data always matches the visible text.
 *
 * Rules (same as lib/guides): only describe what the live product does (check the code, prices and
 * policies, not the pitch); companion framing, never GP, clinic or medication advice; no invented
 * ratings, stats or user numbers. Prices come from NURA_PRODUCT.pricingLine and lib/billing.
 */

export type FaqItem = { q: string; a: string };
export type FaqGroup = { id: string; heading: string; items: FaqItem[] };

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "about",
    heading: "About Nura",
    items: [
      {
        q: "What is Nura?",
        a: "Nura is an AI health and wellbeing companion. You tell it what's going on in plain words (how you're sleeping, what's stressing you, a habit you want to keep, or someone you look out for), it keeps a simple Care plan, and it checks in on you by message, WhatsApp or a short phone call at the times that suit you.",
      },
      {
        q: "How does Nura work?",
        a: "There are three steps. First, tell Nura what's going on, by typing, a voice note or a photo. Second, Nura turns it into a Care plan with a next step, so what matters to you stays in one place. Third, Nura checks in when the next step is due and remembers your answer, so the next check-in follows on from the last.",
      },
      {
        q: "Who is Nura for?",
        a: "Anyone who wants a bit of help keeping on top of everyday wellbeing: sleep, stress, energy, routines and habits. It's also for people looking out for someone else, such as an older parent who lives alone, because Nura can check in on them too, with their agreement.",
      },
      {
        q: "Is Nura a medical app? Does it diagnose?",
        a: "No. Nura is a wellbeing companion, not a medical device. It organises, remembers and checks in. It does not diagnose, prescribe, change medication, or replace doctors, therapists or emergency care.",
      },
      {
        q: "Is this the same Nura as other products called Nura?",
        a: "No. This Nura is the wellbeing companion app at usenura.app, made by Zapx Labs (Zapx Solutions Limited). It isn't connected to other companies or products that use the name Nura.",
      },
      {
        q: "Can I try Nura without signing up?",
        a: "Yes. The try-it box on the usenura.app home page lets you describe your situation in a sentence or two and see the kind of plan Nura would make, with no account. What you type there isn't stored.",
      },
    ],
  },
  {
    id: "check-ins",
    heading: "Check-ins",
    items: [
      {
        q: "What is a check-in?",
        a: "A short moment where Nura comes back to you about something you said mattered, for example \"How did last night's wind-down go?\" You can answer with a tap, a message or a voice note, ask Nura something, or reschedule it.",
      },
      {
        q: "How does Nura check in: app, WhatsApp or phone call?",
        a: "You choose. Check-ins can stay in the app, come as WhatsApp messages, or be a short phone call. You can pick more than one, and change it any time. Nura only messages or calls you for a reason you chose.",
      },
      {
        q: "Can I choose when Nura checks in?",
        a: "Yes. You set the time, and check-ins can repeat daily, on weekdays or weekly. You can also use everyday times like \"after work\": Nura asks once what that means for you and remembers it. Quiet hours let you keep nights free.",
      },
      {
        q: "What happens if I miss a check-in?",
        a: "Nothing bad. You can do it later or reschedule it from the Today screen. If you've invited family to a Care plan and switched on the circle alert, they get a nudge when a scheduled check-in still isn't done a day later.",
      },
      {
        q: "Can Nura remind me to take my medication?",
        a: "Yes, as a reminder. Tell Nura something like \"remind me every morning to take my tablets\" and it sets up a repeating check-in that asks whether you've taken it. It doesn't give advice on doses, timings or side effects; for those it points you to the leaflet or your pharmacist.",
      },
      {
        q: "Does Nura give medical advice?",
        a: "No. Nura helps you keep track of what's going on and what you planned to do, and it encourages you to speak to a pharmacist, GP or other professional when something needs one. It never tells you to start, stop or change a medicine.",
      },
    ],
  },
  {
    id: "care-plans",
    heading: "Care plans",
    items: [
      {
        q: "What is a Care plan in Nura?",
        a: "Your own plan inside the app for one thing you're working on, such as a better sleep routine, work stress, or checking in on Mum. It holds your notes, the next step and the check-ins that go with it. You can have several Care plans at once.",
      },
      {
        q: "Is a Nura Care plan the same as a council care plan?",
        a: "No. A council care and support plan follows a needs or carer's assessment and sets out the support the council arranges. Nura's Care plans are your own and don't replace one, but you can tell Nura what the council plan says, or attach a photo of it, and Nura checks in with you on whether the support is happening.",
      },
      {
        q: "Can I add photos, documents or voice notes?",
        a: "Yes. You can attach images, files, documents and voice notes to a Care plan. Nura treats them as context for that plan and keeps to what you shared or confirmed.",
      },
    ],
  },
  {
    id: "someone-you-care-for",
    heading: "Checking in on someone you care for",
    items: [
      {
        q: "Can Nura check in on my mum or dad?",
        a: "Yes. Start a Care plan, choose \"Someone I care for\" and add their first name, relationship, phone number and time zone. Once they agree, Nura gives them a short phone call now and then, asks how things are going, and sends you a short summary of each call.",
      },
      {
        q: "Does the person I care for need a smartphone or the Nura app?",
        a: "No. Nura calls their ordinary phone number. They don't need an account, an app or a smartphone.",
      },
      {
        q: "How do they agree to calls, and how do they stop them?",
        a: "You send them a link and they tap Yes, or you confirm that they know about Nura and are happy to be called. Nura won't call until one of those happens. They can say \"stop\" on any call, or use the same link, and the calls end.",
      },
      {
        q: "When does Nura call them?",
        a: "Only in their daytime: between 9am and 8pm in their own time zone, whatever your own settings are.",
      },
      {
        q: "Is Nura an alarm or an emergency service?",
        a: "No. A scheduled call can't respond to a fall or an emergency between calls. For that, look at personal alarms or telecare. Nura works alongside them, helping you notice how someone is doing week to week.",
      },
    ],
  },
  {
    id: "family",
    heading: "Family and your Care circle",
    items: [
      {
        q: "Can my siblings or family see how things are going?",
        a: "Yes, if you invite them to a specific Care plan. Everyone you invite sees the same plan, its next steps and whether check-ins are done, and Nura writes them a short update from that plan. You can remove anyone at any time.",
      },
      {
        q: "What can people I invite see?",
        a: "Only that Care plan's title, pinned note, roadmap and check-in status. They can't see your conversations with Nura, your attachments, your other Care plans or your contact details. You can always read the exact update they're sent.",
      },
    ],
  },
  {
    id: "privacy",
    heading: "Health data and privacy",
    items: [
      {
        q: "Does Nura work with Apple Health and Health Connect?",
        a: "Yes, if you choose to connect them. Nura can read steps, sleep, resting heart rate, weight and blood pressure (only the types you allow) and never writes back. It uses daily summaries to make check-ins more personal, for example a gentle check-in when your sleep drops well below your usual. Disconnecting deletes that data.",
      },
      {
        q: "Does Nura use AI, and who processes what I share?",
        a: "Yes. Nura asks your permission before anything you share goes to an AI model. Written replies and plans are generated using Anthropic's Claude models, and voice calls and voice notes use ElevenLabs. These providers only receive what they need to do that job and may not use your health context for their own purposes.",
      },
      {
        q: "Are calls recorded?",
        a: "Calls may be recorded and transcribed so Nura can keep track of what was said and write your summary. Nothing you've told Nura privately is read out to someone you care for.",
      },
      {
        q: "Does Nura sell my data or use it for ads?",
        a: "No. Nura doesn't sell your health context and doesn't use it for advertising. Health data from Apple Health or Health Connect is never used for ads or analytics.",
      },
      {
        q: "How do I download or delete my data?",
        a: "Go to Me, then Data & export. You can download a complete copy of what Nura holds, or permanently delete your account and its data. Both take effect immediately, and deletion can't be undone. usenura.app/delete-account explains how to delete from the app or by email.",
      },
    ],
  },
  {
    id: "pricing",
    heading: "Pricing and plans",
    items: [
      {
        q: "How much does Nura cost?",
        a: "Nura Plus is US$9.99 a month after a 14-day free trial. The price may vary by region, and you can cancel any time.",
      },
      {
        q: "Is there a free trial, and do I need a card?",
        a: "Yes, 14 days. You add a card to start the trial and aren't charged until it ends. To check the card can pay, Nura places a small hold that's released straight away. You can also try the planner on the home page with no account and no card.",
      },
      {
        q: "How do I cancel Nura Plus?",
        a: "On the web, from the Billing page. If you subscribed on iPhone, cancel in your Apple subscriptions; on Android, in Google Play. Cancel before the trial ends and you won't be charged. After that, access stays until the end of the period you've paid for.",
      },
      {
        q: "What do friends get from my invite link?",
        a: "Everyone has a personal invite link. A friend who signs up through it gets 30 days of Nura Plus with no card needed.",
      },
      {
        q: "Are calls to someone I care for included?",
        a: "Yes, calls to someone you care for are part of Nura Plus.",
      },
    ],
  },
  {
    id: "platforms",
    heading: "Apps and devices",
    items: [
      {
        q: "Is Nura on iPhone and Android?",
        a: "Yes. Nura is on the App Store for iPhone and on Google Play for Android, and the same account works on the web at usenura.app.",
      },
      {
        q: "How is Nura different from a habit tracker or reminder app?",
        a: "A reminder tells you the time; Nura asks how it went. It remembers what you said mattered, follows up on the step you chose, shrinks the step on a hard week instead of piling on, and can reach you by WhatsApp or a short call when app notifications have become background noise.",
      },
      {
        q: "Is Nura a therapy app?",
        a: "No. Nura is a wellbeing companion. It can check in on how you're feeling and help you pick one small step, but it isn't therapy and doesn't replace a therapist or counsellor.",
      },
      {
        q: "What should I do in a crisis?",
        a: "Nura is not an emergency service. If you are in crisis or someone is in danger, call 999 in the UK or 911 in the US. In the UK, Samaritans are on 116 123 at any time; in the US, call or text 988. If you mention thoughts of self-harm or immediate danger, Nura tells you to contact emergency or crisis services straight away.",
      },
    ],
  },
];

export const FAQ_COUNT = FAQ_GROUPS.reduce((n, group) => n + group.items.length, 0);
