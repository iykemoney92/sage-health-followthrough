import { SRC } from "../sources";
import type { Guide } from "../types";
import { CARE_FOR_TEASER, IMG, media, teaser } from "./media";

/**
 * Medicine reminders, strictly as reminders: never doses, timings, interactions or advice.
 * Every page sends medicine questions to the leaflet, a pharmacist or a GP.
 */
const REMINDER_TEASER = teaser(
  IMG.channels,
  "A reminder that asks, not just pings",
  "Tell Nura what you want reminding about and when. It checks in daily, on weekdays or weekly, in the app, on WhatsApp or with a short call, and asks whether it's done.",
  "Set up reminders free",
  "reminders",
);

export const REMINDER_GUIDES: Guide[] = [
  {
    slug: "medication-reminder-app",
    category: "medication",
    question: "Medication reminder apps: how to choose one that works",
    title: "Medication reminder apps: how to choose",
    description:
      "What separates a reminder app you'll keep using from one you'll ignore: how it reminds you, whether it asks, what it costs, privacy, and family options.",
    answer:
      "Choose a medication reminder app by how you actually live, not by its feature list. Look for reminders that reach you where you'll notice them (notification, message or call), that ask whether you've taken it rather than just pinging, an easy way to see what you've missed, clear privacy terms, and family options if someone helps you. Then check your pharmacist is happy with the schedule you enter.",
    why:
      "Most people stop using reminder apps within weeks. Notifications get swiped away on autopilot, the app needs opening to log anything, and the schedule falls out of date when a medicine changes. The NHS mentions smartphone apps as one type of medicine reminder alongside pill organisers and automatic dispensers, and suggests asking a pharmacist which kind would help.",
    sections: [
      {
        heading: "What to look for in a medication reminder app",
        paras: [],
        list: [
          "How it reminds you: a notification is easy to ignore; a message or a call is harder to miss.",
          "Whether it asks: \"Have you taken it?\" with a one-tap answer, so you know later.",
          "Flexible schedules: daily, weekdays, weekly, and easy to change.",
          "A record: what was taken and missed, which helps at a pharmacy or GP review.",
          "Family options: whether a carer or relative can be kept in the loop, with your say-so.",
          "Privacy: what's stored, whether it's sold or shared, and how to delete it.",
          "Cost: free, one-off, or a subscription.",
          "No dose advice: an app should remind you of what you've been prescribed, not tell you what to take.",
        ],
      },
      {
        heading: "Is a free medication reminder app enough?",
        paras: [
          "For one or two medicines at fixed times, the reminders built into your phone or a free app may be all you need. Paid apps tend to add things like calls, family sharing or a history. Whichever you use, the schedule should match the label and what your pharmacist or prescriber told you.",
        ],
      },
    ],
    steps: [
      {
        title: "Write down what you take and when",
        body: "From the labels or your repeat prescription list. If you're unsure of the timing, ask your pharmacist first.",
      },
      {
        title: "Decide how you notice things",
        body: "If you ignore notifications, choose something that messages or calls.",
      },
      {
        title: "Try one app for two weeks",
        body: "Set it up fully, then see whether you're actually acting on the reminders.",
      },
      {
        title: "Keep it up to date",
        body: "Change the schedule the same day a medicine changes.",
      },
      {
        title: "Bring the record to reviews",
        body: "Missed doses are useful information for your pharmacist or GP.",
      },
    ],
    avoid: [
      "Apps that suggest doses or interactions you haven't checked with a pharmacist.",
      "Relying on a notification you've learnt to swipe away.",
      "Doubling up after a missed dose. The NHS says it's dangerous to take a double dose later to make up for a missed one.",
    ],
    nura:
      "Nura isn't a pill-tracking app, but it can be the reminder. Tell it something like \"remind me every morning to take my tablets\" and it sets up a repeating check-in, daily, on weekdays or weekly, in the app, on WhatsApp or with a short call. It asks whether you've taken it and notes a missed one so it's there next time. It doesn't give dose advice; if a dose was missed, it points you to the leaflet or your pharmacist.",
    faqs: [
      {
        q: "What is the best app for medication reminders?",
        a: "The one you'll actually respond to. If you swipe notifications away, choose an app that messages or calls and asks whether you've taken it.",
      },
      {
        q: "Can a pharmacist help with reminders?",
        a: "Yes. The NHS suggests asking your pharmacist about medicine reminders such as dosette boxes, which aren't always free or suitable for every medicine.",
      },
    ],
    sources: [SRC.medicinesForCarers, SRC.pharmacies, SRC.medicinesAZ],
    related: [
      "how-to-remember-to-take-medication",
      "medication-reminders-on-iphone-and-android",
      "pill-reminders-for-elderly-people",
      "missed-a-dose-of-medication-what-to-do",
    ],
    media: media(IMG.channels, "Nura's check-ins can reach you in the app, on WhatsApp or as a short phone call."),
    teaser: REMINDER_TEASER,
  },
  {
    slug: "pill-reminders-for-elderly-people",
    category: "medication",
    question: "Pill reminders for elderly people: boxes, alarms, dispensers and calls",
    title: "Pill reminders for elderly people",
    description:
      "The kinds of medicine reminder that suit older people, from dosette boxes to automatic dispensers and reminder calls, and how to choose.",
    answer:
      "The main options are a pill organiser or dosette box (often filled by the pharmacy), an alarm or automatic dispenser that beeps and opens at the right time, a reminder call from family or a service, a carer visiting at medicine times, and phone or app reminders. The NHS suggests asking a pharmacist which would suit, since not every medicine can go in a dosette box.",
    why:
      "Forgetting tablets is common, especially with several medicines at different times of day. But the right reminder depends on the person: an app is no use to someone who doesn't use a smartphone, and a beeping dispenser can be confusing for some. Older people also have a right to decide how involved family are in their medicines; the NHS notes the person you care for has a right to confidentiality.",
    sections: [
      {
        heading: "What does the NHS suggest when someone keeps forgetting?",
        paras: ["For people who often forget their medicines, the NHS suggests:"],
        list: [
          "Telephoning them when they need to take their medicine.",
          "Arranging for care workers to visit at medicine times.",
          "An automatic pill dispenser that beeps and opens to the right pills at the right time.",
          "Asking a pharmacist about dosette boxes and other reminders.",
          "Asking the GP surgery about a structured medication review if they take several medicines.",
        ],
      },
      {
        heading: "Which reminder suits which person?",
        paras: [],
        list: [
          "Comfortable with routine, just forgets occasionally: a pill organiser by the kettle plus a phone alarm.",
          "Several medicines at different times: a pharmacy-filled dosette box, if suitable.",
          "Often unsure whether they've taken it: an automatic dispenser, or a call that asks.",
          "Lives alone and you're far away: a regular reminder call from family or a service, with their agreement.",
          "Needs hands-on help: a carer visit timed with medicines (ask about a needs assessment).",
        ],
      },
    ],
    steps: [
      {
        title: "Ask the person what would help",
        body: "And how much they want family involved.",
      },
      {
        title: "Talk to the pharmacist",
        body: "About organisers, dosette boxes, large-print labels and delivery.",
      },
      {
        title: "Match the reminder to the person",
        body: "Use the list above. Start simple.",
      },
      {
        title: "Keep medicines in one place",
        body: "The NHS suggests one place, ideally locked if children visit.",
      },
      {
        title: "Order repeats in time",
        body: "So they don't run out. The pharmacy may deliver.",
      },
    ],
    avoid: [
      "Making the person take a double dose to catch up. The NHS says that's dangerous.",
      "Setting up reminders they haven't agreed to.",
      "Putting medicines in an organiser without checking with the pharmacist that they're suitable.",
    ],
    nura:
      "If you're far away, Nura can be the reminder call, with your parent's agreement. You start a Care plan about them and send them a link; once they tap Yes, Nura gives them a short call in their daytime (only between 9am and 8pm their time) and tells you how it went. Nura reminds and asks; it doesn't advise on doses or timings. Calls to someone you care for are part of Nura Plus.",
    faqs: [
      {
        q: "What is the best pill reminder for elderly people?",
        a: "It depends on the person. Pharmacy-filled organisers, automatic dispensers and regular reminder calls each suit different needs. A pharmacist can help you choose.",
      },
      {
        q: "Are dosette boxes free?",
        a: "Not always. The NHS says they aren't always available free on the NHS and aren't suitable for every medicine.",
      },
    ],
    sources: [SRC.medicinesForCarers, SRC.pharmacies, SRC.repeatPrescription],
    related: [
      "medication-reminder-for-elderly-parent",
      "medication-reminder-app",
      "how-to-remember-to-take-medication",
      "how-to-check-on-an-elderly-parent-who-lives-alone",
    ],
    media: media(
      IMG.howTheyAgree,
      "With Nura, your parent agrees to calls first, and they only ring in their daytime.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "medication-reminders-on-iphone-and-android",
    category: "medication",
    question: "How to set medication reminders on iPhone and Android",
    title: "Medication reminders on iPhone and Android",
    description:
      "Set up medicine reminders with the tools already on your phone (Apple's Health app, alarms, voice assistants) and when a dedicated app is worth it.",
    answer:
      "On iPhone, the Health app has a Medications section (Browse, then Medications) where you add each medicine and its schedule, and your phone reminds you and lets you log it. On Android there's no medication section built into every phone, so most people use a labelled repeating alarm in the Clock app, a repeating reminder from the voice assistant, or a reminder app. Enter only the schedule on your label or from your pharmacist.",
    why:
      "Phones are good at reminding and bad at noticing that you ignored the reminder. Alarms get snoozed, notifications pile up, and after a few weeks they become background noise. It also helps to know what each tool does, because the menus differ between phone makers and software versions.",
    sections: [
      {
        heading: "On iPhone (Apple Health)",
        paras: [
          "Open the Health app, tap Browse, then Medications, and add a medicine. You can set when you take it, and your iPhone (and Apple Watch, if you have one) will remind you and let you mark it as taken or skipped. Menus can change between iOS versions, so check Apple's own help pages if yours looks different.",
        ],
      },
      {
        heading: "On Android",
        paras: [
          "Options that work on most Android phones:",
        ],
        list: [
          "Clock app: create an alarm, set it to repeat on the right days, and label it with what to take.",
          "Voice assistant: ask it to remind you every day at a set time.",
          "Your phone maker's health app, if it has a medicines feature.",
          "A dedicated reminder app, if you want logging or family options.",
        ],
      },
    ],
    steps: [
      {
        title: "Check the schedule first",
        body: "Use the label or ask your pharmacist. Don't guess timings.",
      },
      {
        title: "Set one reminder per time of day",
        body: "Group medicines taken together so you get one prompt, not five.",
      },
      {
        title: "Put the medicine where you'll see it",
        body: "Next to something you use at that time, safely out of children's reach.",
      },
      {
        title: "Log it",
        body: "Mark it taken in the app, or tick a printed chart, so you can tell later.",
      },
      {
        title: "Update reminders when anything changes",
        body: "Same day, every time.",
      },
    ],
    avoid: [
      "Snoozing and forgetting. If you snooze, take it when it goes off again or set a second reminder.",
      "Using reminders for doses you haven't confirmed with a pharmacist.",
      "Taking a double dose to make up for a missed one.",
    ],
    nura:
      "If phone reminders have become background noise, Nura can check in differently. Tell it what you want reminding about and when, and it sets up a repeating check-in, daily, on weekdays or weekly, in the app, on WhatsApp or with a short phone call, and asks whether you've done it. Nura also works with Apple Health and Health Connect for sleep and steps if you choose, but it doesn't read your medication list from them.",
    faqs: [
      {
        q: "Does iPhone have a medication reminder?",
        a: "Yes. The Health app has a Medications section where you add medicines and schedules, and it reminds you and lets you log them.",
      },
      {
        q: "Does Android have a built-in medication reminder?",
        a: "Not on every phone. A repeating labelled alarm, a voice-assistant reminder or a reminder app all work.",
      },
    ],
    sources: [SRC.medicinesForCarers, SRC.pharmacies],
    related: ["medication-reminder-app", "how-to-remember-to-take-medication", "how-to-make-a-medicine-schedule", "missed-a-dose-of-medication-what-to-do"],
    media: media(IMG.channels, "Nura can check in by app, WhatsApp or a short call: useful when phone alarms have stopped working for you."),
    teaser: REMINDER_TEASER,
  },
  {
    slug: "how-to-make-a-medicine-schedule",
    category: "medication",
    question: "How to make a medicine schedule (with a free printable chart)",
    title: "How to make a medicine schedule",
    description:
      "Turn your labels into a simple weekly medicine chart with tick boxes. Free printable maker, no sign-up, and what to check with your pharmacist.",
    answer:
      "List each medicine with the dose and times exactly as the label or your pharmacist says, group them by time of day (morning, midday, evening, bedtime), then make a weekly chart with a tick box for each one. Nura's free medicine schedule maker does this in your browser and prints an A4 or US Letter chart. It's a personal reminder chart, not medical advice.",
    why:
      "With several medicines, labels like \"three times a day\" or \"every 8 hours\" are easy to mix up, and it's hard to remember whether you've already taken something. A chart by the kettle or the pill box makes it visible, and is easy for a carer or relative to follow too. The NHS stresses giving medicines at the right time of day and knowing whether they're taken with food or between meals.",
    sections: [
      {
        heading: "What goes on a medicine schedule?",
        paras: [],
        list: [
          "Medicine name and strength, as on the label.",
          "Dose (for example \"1 tablet\").",
          "Times of day, and whether with food or between meals if the label says.",
          "Days, if it isn't daily.",
          "A tick box for each dose.",
          "Pharmacy phone number at the bottom.",
        ],
      },
      {
        heading: "How do you space out \"three times a day\" or \"every 8 hours\"?",
        paras: [
          "Follow the label and the leaflet, and ask your pharmacist if it isn't clear. Some medicines need precise spacing and others just need taking with meals, so it's a question for them, not a calculator. Once you know the times, put them on the chart.",
        ],
      },
    ],
    steps: [
      {
        title: "Gather the labels",
        body: "Or your repeat prescription list. Include anything you buy over the counter, and check with the pharmacist that it's safe with your prescribed medicines.",
      },
      {
        title: "Confirm the times",
        body: "Ask the pharmacist about anything unclear, such as spacing or food.",
      },
      {
        title: "Group by time of day",
        body: "Morning, midday, evening, bedtime.",
      },
      {
        title: "Make the chart",
        body: "Use the free maker linked on this page, or a sheet of paper with a row per medicine and a column per day.",
      },
      {
        title: "Put it where the medicines are",
        body: "Tick each dose as it's taken.",
      },
      {
        title: "Redo it when anything changes",
        body: "Throw the old chart away so there's only one version.",
      },
    ],
    avoid: [
      "Working out timings yourself when the label isn't clear.",
      "Keeping old charts after a change.",
      "Taking a double dose to make up for a missed one. The NHS says that's dangerous.",
    ],
    nura:
      "The chart shows what to take; Nura can make sure the reminder actually reaches you. Tell Nura what you want reminding about and when, and it checks in daily, on weekdays or weekly, in the app, on WhatsApp or with a short call, and asks whether it's done. Nura doesn't check doses or interactions.",
    faqs: [
      {
        q: "Is the medicine schedule maker free?",
        a: "Yes. It runs in your browser with no sign-up, and nothing you type is uploaded.",
      },
      {
        q: "Can I use the chart for someone I care for?",
        a: "Yes, with their agreement. The NHS notes the person you care for decides how much of their medicines information you see.",
      },
    ],
    sources: [SRC.medicinesForCarers, SRC.pharmacies, SRC.medicinesAZ],
    related: ["how-to-keep-a-list-of-your-medications", "medication-reminders-on-iphone-and-android", "how-to-remember-to-take-medication", "pill-reminders-for-elderly-people"],
    media: media(IMG.channels, "After the chart, Nura can check in at the times you choose, by app, WhatsApp or call."),
    teaser: REMINDER_TEASER,
  },
];
