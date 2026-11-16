import { SRC } from "../sources";
import type { Guide } from "../types";
import { CARE_FOR_TEASER, CHECK_IN_TEASER, IMG, TRY_LINK, media } from "./media";

/** Everyday routines and wellbeing check-ins: Nura's companion-first ground. */
export const WELLBEING_GUIDES: Guide[] = [
  {
    slug: "how-to-fix-your-sleep-schedule",
    category: "routines",
    question: "How to fix your sleep schedule",
    title: "How to fix your sleep schedule",
    description:
      "Reset a sleep schedule that's drifted late: anchor your wake-up time, shift bedtime gradually, use light and a wind-down, and stop sleeping in.",
    answer:
      "Pick a wake-up time you can keep every day, including weekends, and stick to it even after a bad night. Go to bed only when you're sleepy, give yourself an hour to wind down, keep screens out of the last part of the evening, and avoid caffeine and alcohol late in the day. Your bedtime will settle earlier within a week or two because your body clock follows a fixed wake time.",
    why:
      "Most people try to fix a late schedule by going to bed early, then lie awake, get frustrated, and sleep in to make up for it, which pushes everything later again. The NHS advice for poor sleep focuses on the opposite end: getting up at the same time every day and not sleeping in after a bad night. Late-night phones, irregular shifts and stress make the drift worse.",
    sections: [
      {
        heading: "What the NHS suggests for better sleep",
        paras: ["For people who regularly struggle to sleep, the NHS suggests:"],
        list: [
          "Only going to bed when you're sleepy.",
          "Waking up and getting out of bed at the same time every day.",
          "Relaxing for at least an hour before bed, for example a bath or a book.",
          "Keeping the bedroom dark and quiet, and the bed comfortable.",
          "Exercising regularly during the day, but not in the 4 hours before bed.",
          "Avoiding caffeine, alcohol and smoking in the 6 hours before bed, and big meals late at night.",
          "Not using phones or watching TV right before bed.",
          "Not napping during the day, and not sleeping in after a bad night.",
        ],
      },
      {
        heading: "How long does it take to fix a sleep schedule?",
        paras: [
          "It varies. Moving a fixed wake time earlier by 15 to 30 minutes every few days is gentler than a big jump. The NHS says most healthy adults need around 7 to 9 hours, and that if changing your sleep habits hasn't helped, or you've had trouble sleeping for months, it's worth seeing a GP.",
        ],
      },
    ],
    steps: [
      {
        title: "Choose your wake-up time",
        body: "Make it one you can keep seven days a week. This is the anchor.",
      },
      {
        title: "Get light early",
        body: "Open the curtains or get outside soon after waking. It helps your body clock know it's morning.",
      },
      {
        title: "Move bedtime gradually",
        body: "Go to bed when you're sleepy, not at a target time. As the fixed wake time takes effect, sleepiness arrives earlier.",
      },
      {
        title: "Build an hour of wind-down",
        body: "Same few steps each night: dim lights, phone on charge outside the bedroom, something calm.",
      },
      {
        title: "Cut late caffeine and alcohol",
        body: "The NHS suggests none in the 6 hours before bed.",
      },
      {
        title: "Don't sleep in after a bad night",
        body: "It's tempting, but it resets the clock you're trying to fix.",
      },
    ],
    avoid: [
      "Going to bed hours early and lying awake.",
      "Catching up with long weekend lie-ins.",
      "Scrolling in bed \"until you feel tired\".",
      "Daytime naps while you're resetting.",
    ],
    nura:
      "Nura can be the nudge that keeps a new schedule going. Tell it your target wake time and what's been keeping you up, and it checks in at a time you choose, in the app, on WhatsApp or with a short call, asking how last night went and keeping a note so you can see the trend. If you connect Apple Health or Health Connect, it can read a daily sleep summary (only the types you allow). It doesn't diagnose sleep problems; if poor sleep keeps going, talk to your GP.",
    faqs: [
      {
        q: "Can I fix my sleep schedule in one night?",
        a: "Usually not. Staying up all night to reset tends to backfire. A fixed wake time kept for a week or two works better.",
      },
      {
        q: "Should I nap if I'm tired while fixing my sleep?",
        a: "The NHS advice for poor sleep is not to nap during the day.",
      },
      {
        q: "How many hours of sleep do adults need?",
        a: "The NHS says most healthy adults need around 7 to 9 hours a night, though it varies.",
      },
    ],
    sources: [SRC.insomnia, SRC.sleep],
    related: ["how-to-get-into-a-sleep-routine", "bedtime-routine-for-adults", "how-to-manage-stress-from-work", "daily-wellbeing-check-in"],
    media: media(
      IMG.chatSleep,
      "A real Nura conversation with a demo account: work stress, five hours' sleep, and a check-in Nura scheduled for the evening.",
    ),
    teaser: CHECK_IN_TEASER,
  },
  {
    slug: "bedtime-routine-for-adults",
    category: "routines",
    question: "A bedtime routine for adults that helps you sleep",
    title: "A bedtime routine for adults",
    description:
      "A simple hour-before-bed routine for adults, built on NHS sleep advice, plus how to make it stick on busy or stressful nights.",
    answer:
      "Give yourself about an hour to wind down: dim the lights, put your phone away, do something calm like a bath, reading or stretching, write down anything on your mind, and go to bed when you feel sleepy. Do the same few steps in the same order every night, and get up at the same time each morning, so your body learns the pattern.",
    why:
      "Adults rarely have a bedtime routine; the evening just ends when the last email or episode does. Screens, late caffeine and a busy head keep you alert just when you want to switch off. The NHS suggests relaxing for at least an hour before bed and not using phones or watching TV right before, which is hard to do without a deliberate routine.",
    sections: [
      {
        heading: "A sample bedtime routine",
        paras: ["Adjust times to fit your wake-up time:"],
        list: [
          "9:30pm: last caffeine long gone (the NHS suggests none in the 6 hours before bed). Finish eating; avoid big late meals.",
          "10:00pm: lights down. Phone on charge outside the bedroom or on the other side of the room.",
          "10:05pm: write tomorrow's to-do list and any worries on paper, so they're out of your head.",
          "10:15pm: something calm: a bath or shower, a book, gentle stretches, quiet music.",
          "10:45pm: bed, if you're sleepy. If not, keep reading somewhere else until you are.",
          "Same wake-up time every morning, including weekends.",
        ],
      },
      {
        heading: "What are good habits before sleeping?",
        paras: [
          "Beyond the routine itself, the NHS suggests a dark, quiet bedroom (curtains, blinds, an eye mask or ear plugs if needed), a comfortable bed, regular exercise during the day but not in the 4 hours before bed, and avoiding alcohol and smoking in the evening.",
        ],
      },
    ],
    steps: [
      {
        title: "Work back from your wake time",
        body: "Decide when you need to get up, then plan the hour before you'd like to be asleep.",
      },
      {
        title: "Pick three or four steps",
        body: "Fewer steps you'll actually do beat an elaborate routine you'll skip.",
      },
      {
        title: "Set a wind-down cue",
        body: "An alarm or reminder an hour before bed that means \"start the routine\".",
      },
      {
        title: "Keep the phone out of reach",
        body: "Use a cheap alarm clock if your phone is your alarm.",
      },
      {
        title: "Do it every night for two weeks",
        body: "Then notice what's changed and adjust.",
      },
    ],
    avoid: [
      "Lying in bed scrolling until you feel tired.",
      "A routine so long that you resent it.",
      "Changing everything at once.",
    ],
    nura:
      "Nura can be your wind-down cue and the check-in the next morning. Tell it the routine you're trying and when, and it checks in at that time, in the app, on WhatsApp or with a short call, then asks how you slept so the routine adapts to what actually works. If a stressful week knocks you off, it shrinks the step rather than piling on. If you connect Apple Health or Health Connect, it can read a daily sleep summary (only the types you allow).",
    faqs: [
      {
        q: "How long before bed should a routine start?",
        a: "The NHS suggests relaxing for at least an hour before bed.",
      },
      {
        q: "Is reading on a phone OK before bed?",
        a: "The NHS suggests not using devices like smartphones right before bed, because the light makes you more awake.",
      },
    ],
    sources: [SRC.insomnia, SRC.sleep],
    related: ["how-to-fix-your-sleep-schedule", "how-to-get-into-a-sleep-routine", "how-to-build-a-new-health-habit", "how-to-manage-stress-from-work"],
    media: media(
      IMG.todayCard,
      "A Nura evening check-in on a demo account, asking how tonight's wind-down is going.",
    ),
    teaser: CHECK_IN_TEASER,
  },
  {
    slug: "wellbeing-check-in-questions",
    category: "routines",
    question: "Wellbeing check-in questions to ask yourself or someone else",
    title: "Wellbeing check-in questions",
    description:
      "Simple wellbeing check-in questions for yourself, a friend, a partner or an older parent, and how to ask them so people actually answer.",
    answer:
      "Good wellbeing check-in questions are short, open and specific: \"How did you sleep?\", \"What's taking up most of your headspace?\", \"What's one thing that went well today?\", \"What would make tomorrow a bit easier?\" Ask at a regular time, listen more than you advise, and watch for change over weeks rather than reading too much into one answer.",
    why:
      "\"How are you?\" almost always gets \"fine\". Specific questions are easier to answer honestly, and a regular rhythm makes it normal rather than a sign something's wrong. The NHS's 5 steps to mental wellbeing include asking people how they are and really listening to their answer.",
    sections: [
      {
        heading: "Questions to check in with yourself",
        paras: [],
        list: [
          "How did I sleep, and how's my energy?",
          "What's on my mind most today?",
          "Have I eaten properly and moved at all?",
          "Who have I talked to today?",
          "What went well, even something small?",
          "What's one thing I can do to make tomorrow easier?",
        ],
      },
      {
        heading: "Questions to ask a friend, partner or colleague",
        paras: [],
        list: [
          "How are you really doing this week?",
          "What's been the hardest bit lately?",
          "How are you sleeping?",
          "Is there anything you're dreading?",
          "Is there anything I can take off your plate?",
        ],
      },
      {
        heading: "Questions to ask an older parent",
        paras: [],
        list: [
          "What have you been up to today?",
          "Have you managed to get out for a walk?",
          "What did you have for lunch?",
          "Have you spoken to anyone today?",
          "Is there anything you need from the shops or anything that's been tricky?",
          "What are you looking forward to this week?",
        ],
      },
    ],
    steps: [
      {
        title: "Pick a regular time",
        body: "Same time each day or week. A rhythm makes it ordinary.",
      },
      {
        title: "Use two or three questions",
        body: "Not a questionnaire. Rotate them so it doesn't feel scripted.",
      },
      {
        title: "Listen first",
        body: "Resist jumping to advice. \"That sounds hard\" often opens more than a fix.",
      },
      {
        title: "Notice the trend",
        body: "Keep a light note. A run of poor sleep or no contact with anyone matters more than one off day.",
      },
      {
        title: "Know when to get help",
        body: "If low mood lasts more than 2 weeks, the NHS suggests seeing a GP. If someone is in immediate danger, call 999.",
      },
    ],
    avoid: [
      "Only checking in when you're already worried.",
      "Firing off questions like a form.",
      "Fixing instead of listening.",
    ],
    nura:
      "This is what Nura does. It checks in at times you choose, in the app, on WhatsApp or with a short call, asks a few specific questions based on what you told it matters (sleep, stress, energy, a habit), and remembers your answers so the next check-in follows on. You can also start a Care plan for someone you look out for; with their agreement, Nura calls them in their daytime and tells you how it went.",
    faqs: [
      {
        q: "How often should you do a wellbeing check-in?",
        a: "Whatever you'll keep up. Daily works for a short self check-in; weekly is common with friends or family.",
      },
      {
        q: "What's a good first question for a wellbeing check-in?",
        a: "Something specific and easy to answer, like \"How did you sleep?\" or \"What's on your mind today?\"",
      },
    ],
    sources: [SRC.fiveSteps, SRC.lonely],
    related: ["daily-wellbeing-check-in", "how-to-help-a-lonely-elderly-parent", "how-to-manage-stress-from-work", "daily-check-in-calls-for-elderly-parents"],
    media: media(IMG.todayCard, "A Nura check-in card on a demo account: one specific question, at a time the person chose."),
    teaser: CHECK_IN_TEASER,
  },
  {
    slug: "daily-wellbeing-check-in",
    category: "routines",
    question: "How to do a daily wellbeing check-in with yourself",
    title: "How to do a daily wellbeing check-in",
    description:
      "A two-minute daily check-in on sleep, mood, energy, movement and connection, why it helps, and how to keep doing it after the first week.",
    answer:
      "Once a day, at the same time, spend two minutes rating or describing five things: sleep, mood, energy, movement and connection with other people. Note one thing that went well and one small thing you'll do tomorrow. Look back once a week for patterns, such as what your best days have in common.",
    why:
      "Most of how we feel day to day is shaped by ordinary things (sleep, stress, food, movement, people), but they're easy to lose track of. A quick daily check-in turns a vague \"I've been rubbish lately\" into something you can act on. The hard part is keeping it going after the first enthusiastic week.",
    sections: [
      {
        heading: "The five-question daily check-in",
        paras: [],
        list: [
          "Sleep: how did I sleep, roughly how long?",
          "Mood: in a word, how am I feeling?",
          "Energy: low, OK or good?",
          "Movement: did I get out or move today?",
          "Connection: who did I talk to properly?",
          "Plus: one thing that went well, and one small thing for tomorrow.",
        ],
      },
      {
        heading: "Why these five?",
        paras: [
          "The NHS's 5 steps to mental wellbeing include connecting with other people and being physically active, and its sleep guidance links poor sleep with feeling tired, irritable and less able to cope. Tracking these together helps you see which one moves the others.",
        ],
      },
    ],
    steps: [
      {
        title: "Attach it to something you already do",
        body: "After brushing your teeth, on the bus home, with your evening tea.",
      },
      {
        title: "Keep it to two minutes",
        body: "One word per question is enough.",
      },
      {
        title: "Write it somewhere you'll see again",
        body: "A notes app, a notebook, or a check-in app that keeps the history.",
      },
      {
        title: "Review weekly",
        body: "What did good days have in common? What drained you?",
      },
      {
        title: "Change one thing at a time",
        body: "An earlier wind-down, a lunchtime walk, a call to a friend. Then watch the check-ins.",
      },
    ],
    avoid: [
      "Long journaling sessions you'll abandon.",
      "Judging yourself for low days. The point is noticing.",
      "Tracking everything and changing nothing.",
    ],
    nura:
      "Nura can run the check-in for you instead of relying on memory. It asks at the time you choose, in the app, on WhatsApp or with a short call, keeps what you say in a Care plan, and follows up on the small step you picked. If you connect Apple Health or Health Connect, it can read daily sleep and steps (only the types you allow). If you mention thoughts of self-harm or immediate danger, it tells you to contact emergency or crisis services straight away.",
    faqs: [
      {
        q: "What is a wellbeing check-in?",
        a: "A short, regular moment to notice how you're doing, usually covering sleep, mood, energy, activity and connection.",
      },
      {
        q: "Morning or evening check-in?",
        a: "Whichever you'll keep. Evening is good for reflecting on the day; morning is good for sleep and setting one intention.",
      },
    ],
    sources: [SRC.fiveSteps, SRC.sleep, SRC.stress],
    related: ["wellbeing-check-in-questions", "how-to-build-a-new-health-habit", "how-to-fix-your-sleep-schedule", "how-to-stay-consistent-with-healthy-habits"],
    media: media(
      IMG.goals,
      "Nura starts by asking what you want help with: sleep, stress, energy and habits, work, or someone you care for.",
    ),
    teaser: CHECK_IN_TEASER,
  },
  {
    slug: "how-to-stay-consistent-with-healthy-habits",
    category: "routines",
    question: "How to stay consistent with healthy habits",
    title: "How to stay consistent with healthy habits",
    description:
      "Why habits slip after week two, and what helps them last: tiny versions, a fixed cue, planning for bad days, and someone (or something) checking in.",
    answer:
      "Make the habit small enough to do on your worst day, tie it to a fixed cue (a time or something you already do), plan in advance what you'll do on bad days, and have something check in with you regularly. Consistency comes from making it easy to restart after a miss, not from never missing.",
    why:
      "Most habits fail in the second or third week, when the novelty wears off and normal life (a late shift, a cold, a stressful week) gets in the way. One missed day turns into \"I've blown it\", and the habit quietly stops. All-or-nothing goals make this worse.",
    sections: [
      {
        heading: "What makes habits stick?",
        paras: [],
        list: [
          "A tiny version: \"walk for 10 minutes\" survives bad weeks better than \"run 5k\".",
          "A fixed cue: \"after I make my morning coffee\", not \"sometime today\".",
          "A plan for bad days: decide now what the minimum is when you're tired or ill.",
          "A quick restart rule: never miss twice.",
          "Something that checks in: a friend, a group or a reminder that asks rather than just announces.",
          "Seeing progress: a simple record you can look back on.",
        ],
      },
      {
        heading: "Which habits are worth starting with?",
        paras: [
          "Ones that support everything else. The NHS's 5 steps to mental wellbeing include connecting with people and being physically active, and its physical activity guidelines suggest adults are active every day in some way. A regular sleep time is another foundation habit.",
        ],
      },
    ],
    steps: [
      {
        title: "Pick one habit",
        body: "Just one. Write it as a specific action with a time or cue.",
      },
      {
        title: "Shrink it",
        body: "Cut it down until it feels almost too easy.",
      },
      {
        title: "Decide your bad-day version",
        body: "Two minutes, one glass of water, one stretch. It still counts.",
      },
      {
        title: "Get a check-in",
        body: "Ask a friend, join a group, or use something that asks you whether you did it.",
      },
      {
        title: "Review after two weeks",
        body: "Keep it, grow it slightly, or change the cue if it isn't working.",
      },
    ],
    avoid: [
      "Starting five habits at once.",
      "Big goals with no bad-day version.",
      "Reminders you've learnt to swipe away.",
    ],
    nura:
      "Nura is built for this. Tell it the habit and when, including routine times like \"after work\" (it asks once what that means for you and remembers), and it checks in daily, on weekdays or weekly, in the app, on WhatsApp or with a short call. It asks how it went rather than just pinging you, and if you're having a hard week it shrinks the step instead of piling on.",
    faqs: [
      {
        q: "How long does it take to form a habit?",
        a: "It varies a lot between people and habits. Focus on making the habit easy to repeat rather than counting days.",
      },
      {
        q: "What should I do when I miss a day?",
        a: "Do the smallest version the next day. Missing once is normal; missing twice is when habits slip.",
      },
    ],
    sources: [SRC.fiveSteps, SRC.olderActivity],
    related: ["how-to-build-a-new-health-habit", "daily-wellbeing-check-in", "how-to-get-into-a-sleep-routine", "wellbeing-check-in-questions"],
    media: media(IMG.channels, "In Nura you choose how check-ins reach you: in the app, on WhatsApp, or a short phone call."),
    teaser: CHECK_IN_TEASER,
  },
  {
    slug: "daily-routine-for-elderly-parents",
    category: "elderly",
    question: "A healthy daily routine for elderly parents",
    title: "A healthy daily routine for elderly parents",
    description:
      "A simple daily schedule for an older parent that builds in meals, drinks, movement, company and rest, based on NHS guidance, plus a printable outline.",
    answer:
      "A good daily routine for an older person has regular meals and drinks, some movement every day (with strength and balance activities at least twice a week), time with other people, something to look forward to, and a regular bedtime and wake-up time. Build it around what your parent enjoys and already does, rather than a timetable imposed on them.",
    why:
      "Routines quietly fall apart when someone retires, is bereaved, or lives alone: meals get skipped, days blur together, and weeks go by with little contact. The NHS notes older people are particularly at risk of loneliness if they live alone, and that people aged 65 and over are particularly at risk of malnutrition. A gentle routine protects against both.",
    sections: [
      {
        heading: "Sample daily schedule for an older adult",
        paras: ["Adapt it to your parent's own rhythm:"],
        list: [
          "Morning: get up at a regular time, breakfast and a drink, any morning medicines, open the curtains and get some daylight.",
          "Mid-morning: a short walk, gardening or a few strength and balance exercises; a call with family or a friend.",
          "Lunch: a proper meal, ideally with company some days (a lunch club, a neighbour, a video call).",
          "Afternoon: something they enjoy: a hobby, a group, a class, volunteering, a visitor. A drink.",
          "Evening: an easy meal, a phone call, some wind-down time.",
          "Bedtime: regular time, after an hour of relaxing.",
        ],
      },
      {
        heading: "What the NHS recommends for activity",
        paras: [
          "The NHS says adults aged 65 and over should aim to be physically active every day, even if it's light activity like moving around the home, do activities that improve strength, balance and flexibility on at least 2 days a week, aim for 150 minutes of moderate activity a week, and break up long periods of sitting. It suggests speaking to a GP first if someone hasn't exercised for a while or has medical conditions.",
        ],
      },
    ],
    steps: [
      {
        title: "Ask what a good day looks like for them",
        body: "Start from their preferences and existing habits.",
      },
      {
        title: "Anchor the day",
        body: "Regular wake-up time, meals and bedtime give the rest of the day its shape.",
      },
      {
        title: "Add movement and company",
        body: "One bit of each every day, and one outing or visitor to look forward to each week.",
      },
      {
        title: "Write it down simply",
        body: "A weekly planner on the fridge helps, especially for appointments and visits.",
      },
      {
        title: "Fit in family contact",
        body: "A regular call time becomes part of the routine, and a way to notice if things change.",
      },
    ],
    avoid: [
      "A rigid timetable your parent didn't choose.",
      "Filling every hour; rest matters too.",
      "Days with no contact with anyone.",
    ],
    nura:
      "With your parent's agreement, Nura can become one of the regular moments in their day: a short, friendly call at a time that suits them (only between 9am and 8pm their time) that asks how they're getting on, for example with meals and getting out for a walk, and tells you how it went. Nura doesn't set or enforce routines; it helps everyone notice how they're going.",
    faqs: [
      {
        q: "Why is routine important for elderly people?",
        a: "Regular meals, movement, sleep and contact help people stay well and make it easier to notice when something changes.",
      },
      {
        q: "How much exercise should an elderly person do?",
        a: "The NHS says adults 65 and over should be active every day, do strength and balance activities on at least 2 days a week, and aim for 150 minutes of moderate activity a week.",
      },
    ],
    sources: [SRC.olderActivity, SRC.lonely, SRC.malnutrition, SRC.insomnia],
    related: [
      "how-to-help-a-lonely-elderly-parent",
      "elderly-parent-not-eating",
      "how-to-check-on-an-elderly-parent-who-lives-alone",
      "care-plan-example-for-an-elderly-parent",
    ],
    media: media(
      IMG.tryMum,
      "A Nura plan from one sentence about a mum living alone: eating properly and getting out for a walk most days.",
      TRY_LINK,
    ),
    teaser: CARE_FOR_TEASER,
  },
];

