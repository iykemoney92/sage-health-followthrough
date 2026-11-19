import { SRC } from "../sources";
import type { Guide } from "../types";
import { IMG, TRY_LINK, media, teaser } from "./media";

/**
 * "AI companion" searches: people looking for an AI that checks in on them, by WhatsApp or a
 * call, for wellbeing rather than romance or therapy. Product claims checked against the live
 * code on 19 Nov 2026 (lib/faq.ts, lib/domain/checkin-channel.ts, lib/billing/trial.ts):
 * check-ins in the app, on WhatsApp or as a short call; you choose the times; 14-day trial
 * with a card; crisis signposting; not therapy. Competitor wording is quoted from their own
 * home pages as read on 19 Nov 2026.
 */

const TRIAL_TEASER = teaser(
  IMG.todayCard,
  "The companion that comes back to you",
  "Tell Nura what you're working on in your own words. It keeps a simple Care plan and checks in at the times you choose: in the app, on WhatsApp or with a short call. 14 days free, then US$9.99 a month; cancel any time.",
  "Start your 14-day free trial",
  "companion",
);

const CHANNELS_TEASER = teaser(
  IMG.channels,
  "Pick how Nura reaches you",
  "In the app, on WhatsApp, or a short phone call: choose one or more, set the times, and keep quiet hours free. 14 days free, then US$9.99 a month.",
  "Start your 14-day free trial",
  "companion_channels",
);

const NOT_THERAPY =
  "Nura is a wellbeing companion, not therapy or an emergency service. If you're struggling to cope or in crisis, the NHS lists where to get urgent help, and Samaritans are on 116 123 in the UK at any time (call or text 988 in the US).";

export const COMPANION_GUIDES: Guide[] = [
  {
    slug: "ai-companion-that-checks-in-on-you",
    category: "companion",
    question: "An AI companion that checks in on you (instead of waiting for you)",
    title: "An AI companion that checks in on you",
    description:
      "Most AI apps wait for you to open them. Here's what an AI companion that checks in first looks like, what it's good for, and where it stops.",
    answer:
      "Most AI companions only talk when you open the app. A check-in companion works the other way round: you tell it what you're working on, like sleep, stress or a habit, and it comes back to you at a time you chose, by message, WhatsApp or a short call, to ask how it went and remember the answer.",
    why:
      "The hard part of looking after yourself isn't knowing what to do; it's remembering on an ordinary Tuesday when work runs late. Chat apps are good at answering questions, but they leave the follow-up to you, and app notifications quickly become background noise. The NHS's 5 steps to mental wellbeing are small, regular things like connecting with people, being active and taking notice, and small regular things are exactly what slip without a nudge.",
    sections: [
      {
        heading: "What a check-in companion does differently",
        paras: ["Compared with a chatbot you open when you remember, a check-in companion:"],
        list: [
          "Starts the conversation at a time you set, so you don't have to remember to.",
          "Asks about the one thing you said mattered, not a generic \"how are you?\".",
          "Remembers last time's answer, so a bad week means a smaller step, not starting over.",
          "Reaches you where you already are: a WhatsApp message or a short call rather than another app badge.",
        ],
      },
      {
        heading: "What it isn't",
        paras: [
          "It isn't a friend replacement, a therapist or an alarm. The NHS advice on loneliness puts real-world contact first: talking to people you trust, joining groups, volunteering. A good companion nudges you toward those, not away from them.",
        ],
      },
    ],
    steps: [
      {
        title: "Pick one thing",
        body: "Sleep, stress, energy, a habit or someone you look out for. One focus works better than five.",
      },
      {
        title: "Say it in plain words",
        body: "\"I'm sleeping five hours since the new job and want a wind-down that sticks.\" The detail is what makes the check-ins useful.",
      },
      {
        title: "Choose when and how it reaches you",
        body: "An evening WhatsApp, a short morning call, or in the app. Keep quiet hours for nights.",
      },
      {
        title: "Answer honestly, briefly",
        body: "A one-line reply is enough. \"Bad night\" is useful information.",
      },
      {
        title: "Let the step shrink on hard weeks",
        body: "If it isn't happening, make the step smaller rather than quitting.",
      },
    ],
    avoid: [
      "Setting five goals on day one.",
      "Relying on app notifications you've learned to swipe away.",
      "Using an AI chat in place of people you could talk to.",
      "Expecting it to handle a crisis: it can't.",
    ],
    nura:
      "This is what Nura is built for. Tell it what's going on, and it keeps a simple Care plan and checks in at the times you choose, in the app, on WhatsApp or with a short phone call, asking how it went and remembering the answer. You can connect Apple Health or Health Connect so check-ins can notice your sleep and steps (only the types you allow). Try the planner on the home page with no account; Nura Plus is US$9.99 a month after a 14-day free trial. " +
      NOT_THERAPY,
    faqs: [
      {
        q: "Is there an AI that messages you first?",
        a: "Yes. Some companions, Nura included, send a check-in at a time you choose instead of waiting for you to open an app. In Nura it can be an in-app check-in, a WhatsApp message or a short phone call.",
      },
      {
        q: "Is an AI companion good for loneliness?",
        a: "It can be a gentle nudge, but the NHS advice for loneliness is to build real-world contact: talking to people you trust, joining a group or volunteering. Use a companion to help you do those things, not to replace them.",
      },
      {
        q: "Is an AI companion the same as therapy?",
        a: "No. A wellbeing companion helps with routines and small steps. If you're struggling to cope, talk to your GP, or see the NHS page on urgent mental health help.",
      },
    ],
    sources: [SRC.fiveSteps, SRC.lonely, SRC.urgentMentalHealth],
    related: ["ai-that-calls-you-to-check-in", "ai-accountability-partner-app", "daily-wellbeing-check-in", "how-to-build-a-new-health-habit"],
    media: media(
      IMG.todayCard,
      "A real Nura check-in card on a demo account: Nura comes back about tonight's wind-down, with options to do it now, message Nura or reschedule.",
      TRY_LINK,
    ),
    teaser: TRIAL_TEASER,
  },
  {
    slug: "ai-accountability-partner-app",
    category: "companion",
    question: "An AI accountability partner app that texts you on WhatsApp",
    title: "AI accountability partner on WhatsApp",
    description:
      "How an AI accountability partner works, why WhatsApp or a call beats another app, and how to set one up for sleep, stress or a habit.",
    answer:
      "An AI accountability partner checks back on the thing you said you'd do. Tell it the habit, for example a walk after lunch or lights out by 11, and it messages you at a time you choose, on WhatsApp or by a short call, to ask how it went, then adjusts the next step to what actually happened.",
    why:
      "Accountability works because someone asks. Human accountability partners get busy, and reminder apps only tell you the time; they never ask how it went or notice a run of missed days. Messages in an app you rarely open are easy to ignore, while a WhatsApp message sits next to messages from real people. The NHS's advice on managing stress and building healthy routines leans on small, planned, repeatable steps, which is what a good partner keeps you to.",
    sections: [
      {
        heading: "What to look for in an AI accountability partner",
        paras: [],
        list: [
          "It reaches you somewhere you already look: WhatsApp, a call, or a message you'll actually see.",
          "You set the times, including quiet hours.",
          "It asks about your specific step, not a generic mood score.",
          "It remembers your answers and changes the plan after a bad week.",
          "It's clear about what it does with what you tell it.",
        ],
      },
    ],
    steps: [
      {
        title: "Write the habit as one small action",
        body: "\"10-minute walk after lunch on weekdays\" beats \"get fitter\".",
      },
      {
        title: "Choose the check-in moment",
        body: "Just after the habit should have happened, so the question is easy to answer.",
      },
      {
        title: "Choose the channel",
        body: "WhatsApp if you live in it; a short call if messages get buried.",
      },
      {
        title: "Reply in a few words",
        body: "\"Done\", \"skipped, meeting ran over\". The reason is what helps the next plan.",
      },
      {
        title: "Review weekly",
        body: "Keep what's working, shrink what isn't, and add only one thing at a time.",
      },
    ],
    avoid: [
      "Tracking ten habits at once.",
      "Punishing streak counters that make one missed day feel like failure.",
      "Check-ins at times you're always busy.",
      "Vague goals the partner can't ask about.",
    ],
    nura:
      "Nura works as an accountability partner for wellbeing: sleep, stress, energy, movement and habits. You tell it the step in your own words, choose the times, and it checks in in the app, on WhatsApp or with a short call, then remembers how it went and shrinks the step on a hard week. Nura Plus is US$9.99 a month after a 14-day free trial; you can try the planner on the home page with no account. " +
      NOT_THERAPY,
    faqs: [
      {
        q: "Can an AI hold me accountable on WhatsApp?",
        a: "Yes, if it can message you there. With Nura you can choose WhatsApp as a check-in channel, set the times, and reply in a few words; it remembers your answers for the next check-in.",
      },
      {
        q: "Is an AI accountability partner better than a human one?",
        a: "Not better, just more reliable about asking. A friend or group adds things an AI can't. Many people use both: the AI for the daily nudge, people for the bigger conversations.",
      },
      {
        q: "What habits work best with check-ins?",
        a: "Small, specific ones that happen at a predictable time: a wind-down routine, a short walk, drinking more water, a stress break at work.",
      },
    ],
    sources: [SRC.stress, SRC.fiveSteps, SRC.sleep],
    related: ["ai-companion-that-checks-in-on-you", "how-to-stay-consistent-with-healthy-habits", "how-to-build-a-new-health-habit", "how-to-manage-stress-from-work"],
    media: media(
      IMG.channels,
      "Nura's real setup screen on a demo account: check-ins can reach you in the app, on WhatsApp or as a short phone call.",
      TRY_LINK,
    ),
    teaser: CHANNELS_TEASER,
  },
  {
    slug: "ai-companion-for-older-adults-living-alone",
    category: "companion",
    question: "An AI companion for older adults who live alone",
    title: "AI companion for older adults living alone",
    description:
      "What an AI companion can and can't do for an older person living alone: daily check-in calls, routines, and staying connected with people.",
    answer:
      "For an older person living alone, the most useful AI companion is one that does the reaching out: a short, friendly phone call or message at a set time each day to ask how they're doing and about the plan for the day, with no app to open once it's set up. It works best alongside people, not instead of them.",
    why:
      "Living alone can mean whole days without anyone asking how you are. The NHS notes that loneliness can affect anyone and suggests staying in touch with people, joining groups and keeping active; the NHS guidelines for older adults also encourage some activity every day. Many tech products expect a smartphone and confidence with apps, and companions you have to open yourself are easy to forget about.",
    sections: [
      {
        heading: "What a daily check-in can cover",
        paras: [],
        list: [
          "How they slept and how they're feeling today.",
          "One small plan: a walk, a call to a friend, a club or class.",
          "Everyday routines they want help keeping, like drinking enough or getting out.",
          "A gentle follow-up on yesterday's plan.",
        ],
      },
      {
        heading: "What it should never be",
        paras: [
          "A companion isn't an alarm, can't call for help, and doesn't replace visits, friends or professional care. For emergencies, a personal alarm or a plan with family is the right tool; the NHS lists falls advice and alarm services separately.",
        ],
      },
    ],
    steps: [
      {
        title: "Decide who sets it up",
        body: "They can set it up themselves, or a family member can set up calls for them, with their agreement.",
      },
      {
        title: "Choose a time that suits their day",
        body: "Mid-morning or after lunch often works better than early morning.",
      },
      {
        title: "Keep it to a phone call if apps are a hassle",
        body: "A call to their usual number needs no new skills.",
      },
      {
        title: "Give it a real purpose",
        body: "One small plan per day: a walk, a phone call to a friend, a meal with someone.",
      },
      {
        title: "Keep people in the loop",
        body: "Family can see how things are going if the person agrees, so the companion adds to contact rather than replacing it.",
      },
    ],
    avoid: [
      "Treating an AI as the only daily contact.",
      "Using it in place of an alarm or emergency plan.",
      "Setting it up without the person's agreement.",
      "Calls at times they're usually out or resting.",
    ],
    nura:
      "Nura can check in by a short phone call at a time that suits, so after setup there's nothing to open. An older person can use it for themselves, or a family member can choose \"Someone I care for\" and send them a link: Nura only calls once they say yes, only in their daytime, they can say stop on any call, and the family member hears how it went. Nura isn't an alarm or an emergency service. Nura Plus is US$9.99 a month after a 14-day free trial. " +
      NOT_THERAPY,
    faqs: [
      {
        q: "Do they need a smartphone?",
        a: "Not for the calls. Someone needs to set Nura up on a phone or computer, but the check-ins themselves can be a short call to their phone number.",
      },
      {
        q: "Can an AI companion help with loneliness in older people?",
        a: "It can be a small daily point of contact and a nudge toward people and activities. The NHS advice on loneliness is to build real-world contact, such as groups, volunteering and talking to people you trust, so treat a companion as one support among several.",
      },
      {
        q: "Can it call for help in an emergency?",
        a: "No. Nura isn't an alarm or emergency service. Use a personal alarm and agree an emergency plan with family.",
      },
    ],
    sources: [SRC.lonely, SRC.olderActivity, SRC.alarms],
    related: ["how-to-help-a-lonely-elderly-parent", "daily-check-in-calls-for-elderly-parents", "ai-that-calls-you-to-check-in", "spending-christmas-alone"],
    media: media(
      IMG.checksInWithMargaret,
      "A real Nura Care plan on a demo account: Nura calls Margaret in her daytime, she can say stop on any call, and it won't call until she says yes.",
    ),
    teaser: teaser(
      IMG.someoneICareFor,
      "A friendly call, at a time that suits",
      "Set it up for yourself, or for someone you care for with their OK. Nura calls in their daytime and lets you know how it went. 14 days free, then US$9.99 a month.",
      "Start your 14-day free trial",
      "companion_older",
    ),
  },
  {
    slug: "replika-alternatives-for-wellbeing",
    category: "companion",
    question: "Replika alternatives for wellbeing, not romance",
    title: "Replika alternatives for wellbeing",
    description:
      "Want an AI companion for sleep, stress and routines rather than a relationship? What to look for in a Replika alternative focused on wellbeing.",
    answer:
      "If you want an AI that helps you look after yourself rather than an AI friend or partner, look for a wellbeing companion: one that keeps a plan around your sleep, stress or habits, checks in on you at times you choose, and is clear that it isn't therapy. Apps built around an ongoing relationship with an AI character are a different kind of product.",
    why:
      "\"AI companion\" now covers very different things. Replika describes itself as \"the AI friend to do life with\", and Nomi offers \"a meaningful friendship\", \"a passionate relationship\" or \"an insightful mentor\" (their own home pages, read 19 Nov 2026). That suits some people. Others want something closer to a coach: a nudge to get to bed, a check on a stressful week, and a push back toward real people, which the NHS's 5 steps to mental wellbeing put first.",
    sections: [
      {
        heading: "How to tell the two kinds apart",
        paras: [],
        list: [
          "Relationship companions centre on the character: its personality, memories of you and ongoing conversation.",
          "Wellbeing companions centre on you: a plan, check-ins about it, and progress over weeks.",
          "Ask: does it come back to me about something specific, or wait for me to chat?",
          "Ask: does it encourage time with people, or more time in the app?",
          "Ask: is it clear about privacy and that it isn't therapy or an emergency service?",
        ],
      },
    ],
    steps: [
      {
        title: "Name what you want help with",
        body: "Sleep, stress, energy, a habit, or looking out for someone.",
      },
      {
        title: "Check how it reaches you",
        body: "In-app only, or WhatsApp and calls you'll actually notice.",
      },
      {
        title: "Read what it does with your data",
        body: "Look for plain answers on AI providers, recordings and deleting your data.",
      },
      {
        title: "Try before you commit",
        body: "Use any no-sign-up demo or free trial, and note whether the check-ins help after a week.",
      },
      {
        title: "Keep people in the picture",
        body: "A good companion should make it easier to talk to people, not replace them.",
      },
    ],
    avoid: [
      "Choosing on personality features if what you want is routine help.",
      "Apps that never say what happens to your conversations.",
      "Using any AI app as your crisis plan.",
      "Paying before you've seen a real check-in.",
    ],
    nura:
      "Nura is a wellbeing companion, not a character or a relationship app. It keeps a simple Care plan around your sleep, stress, energy, routines and the people you look out for, and checks in at the times you choose, in the app, on WhatsApp or with a short call. It asks your permission before anything you share goes to an AI model, and doesn't sell your data or use it for ads. Try the planner on the home page with no account; Nura Plus is US$9.99 a month after a 14-day free trial. " +
      NOT_THERAPY,
    faqs: [
      {
        q: "Is there an AI companion that isn't romantic?",
        a: "Yes. Wellbeing companions such as Nura focus on routines, stress and check-ins rather than a relationship with a character.",
      },
      {
        q: "Can an AI companion replace therapy?",
        a: "No. If you're struggling, speak to your GP or use the NHS's urgent mental health help page. A companion can help with day-to-day routines alongside that.",
      },
      {
        q: "Which is better, Replika or a wellbeing app?",
        a: "It depends on what you want. For conversation with an AI character, a relationship companion is built for that. For help sticking to sleep, stress or habit plans, a check-in companion is a better fit.",
      },
    ],
    sources: [SRC.fiveSteps, SRC.lonely, SRC.urgentMentalHealth],
    related: ["ai-companion-that-checks-in-on-you", "ai-accountability-partner-app", "daily-wellbeing-check-in", "how-to-manage-stress-from-work"],
    media: media(
      IMG.goals,
      "Nura's real first screen: you pick what you want help with, from sleep and stress to energy, habits and someone you look out for.",
      TRY_LINK,
    ),
    teaser: TRIAL_TEASER,
  },
  {
    slug: "ai-that-calls-you-to-check-in",
    category: "companion",
    question: "An AI that calls you to check in: how it works",
    title: "An AI that calls you to check in",
    description:
      "How an AI check-in call works, who it suits, what it asks, and how to set times, quiet hours and what it remembers.",
    answer:
      "An AI check-in call is a short phone call from an AI voice at a time you choose. It asks about the thing you said mattered, like last night's sleep or today's plan, listens to your answer, and keeps a summary so the next call picks up where you left off. You can usually choose messages instead on days you'd rather not talk.",
    why:
      "Notifications are easy to ignore and typing is a chore when you're tired. A call takes a minute, needs no app open, and suits people who'd rather talk than text, including many older people. The NHS's advice on stress and sleep stresses regular routines and talking things through, and a call that turns up at the same time each day is a simple way to keep a routine going.",
    sections: [
      {
        heading: "What a good check-in call sounds like",
        paras: ["Short and specific. For example:"],
        list: [
          "\"Hi, it's Nura. Last night you were going to put the phone down at ten. How did that go?\"",
          "\"You said work's been heavy this week. Did you get the lunchtime walk in?\"",
          "\"Anything you'd like me to remember for tomorrow?\"",
        ],
      },
      {
        heading: "Privacy questions to ask first",
        paras: [
          "Find out whether calls are recorded or transcribed, which companies process them, and how to delete your data. Good services answer this plainly before you sign up.",
        ],
      },
    ],
    steps: [
      {
        title: "Choose what the calls are for",
        body: "One focus: sleep, stress, a habit, or a daily hello.",
      },
      {
        title: "Set the time and quiet hours",
        body: "Pick a time you're usually free; keep nights off.",
      },
      {
        title: "Add your number",
        body: "Calls go to your usual phone, so there's nothing to open.",
      },
      {
        title: "Keep answers short",
        body: "A sentence or two is plenty. The summary does the remembering.",
      },
      {
        title: "Adjust after a week",
        body: "Change the time, swap some calls for messages, or narrow the focus.",
      },
    ],
    avoid: [
      "Calls at times you're commuting or in meetings.",
      "Expecting a call to act as an alarm.",
      "Long calls you start to dread; short ones last.",
      "Skipping the privacy questions.",
    ],
    nura:
      "Nura can check in with a short phone call, as well as in the app or on WhatsApp; you pick one or more and set the times. Calls may be recorded and transcribed so Nura can write your summary, and voice calls are processed by ElevenLabs (the FAQ explains who processes what). You can also set up calls for someone you care for, with their OK. Nura Plus is US$9.99 a month after a 14-day free trial. " +
      NOT_THERAPY,
    faqs: [
      {
        q: "Is there an app that calls you every day to check in?",
        a: "Yes. Nura can give you a short daily check-in call at a time you choose, and you can switch to WhatsApp or in-app check-ins whenever you like.",
      },
      {
        q: "Are AI check-in calls recorded?",
        a: "It depends on the service. With Nura, calls may be recorded and transcribed so it can keep track of what was said and write your summary.",
      },
      {
        q: "Can an AI call my mum to check on her?",
        a: "With Nura, yes, if she agrees: you send her a link, she says yes, and Nura calls in her daytime and tells you how it went. She can say stop on any call.",
      },
    ],
    sources: [SRC.stress, SRC.sleep, SRC.lonely],
    related: ["ai-companion-that-checks-in-on-you", "ai-companion-for-older-adults-living-alone", "daily-check-in-calls-for-elderly-parents", "daily-wellbeing-check-in"],
    media: media(
      IMG.channels,
      "Nura's real setup screen on a demo account: choose a short phone call, WhatsApp or in-app check-ins.",
      TRY_LINK,
    ),
    teaser: CHANNELS_TEASER,
  },
];
