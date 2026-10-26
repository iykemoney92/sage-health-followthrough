import { SRC } from "../sources";
import type { Guide } from "../types";

export const ROUTINE_GUIDES: Guide[] = [
  {
    slug: "how-to-build-a-new-health-habit",
    category: "routines",
    question: "How to build a new health habit that actually sticks",
    title: "How to build a health habit that sticks",
    description:
      "Start smaller than feels useful, tie it to a cue you already have, make it easy to do and easy to track, and plan for the days it slips.",
    answer:
      "Start smaller than feels worthwhile, attach it to a cue that already happens every day, make it easy to start and easy to track, and decide in advance what you'll do on the days it slips.",
    why:
      "Most health habits fail in the second or third week, not the first. The early enthusiasm fades, a busy day breaks the chain, and missing once turns into stopping. Habits run on cues and repetition more than motivation, which is why \"I'll do it when I have time\" so rarely works and \"straight after I brush my teeth\" so often does.",
    steps: [
      {
        title: "Choose one habit",
        body: "One at a time. If a clinician gave you several things to change, start with the one that matters most to them or to you.",
      },
      {
        title: "Make it tiny",
        body: "Two minutes of stretching, a ten-minute walk, one glass of water with lunch. You can build up once it's automatic.",
      },
      {
        title: "Pick a cue",
        body: "Something that already happens daily: the kettle, the school run, getting home from work. Do the habit right after it.",
      },
      {
        title: "Remove friction",
        body: "Shoes by the door, the exercise sheet on the fridge, the water bottle on your desk.",
      },
      {
        title: "Track it simply",
        body: "A tick on a calendar or a quick reply to a check-in. Seeing the run of days is motivating in itself.",
      },
      {
        title: "Plan for slips",
        body: "Decide now: if I miss a day, I do the smallest version the next day. Never miss twice is a better rule than never miss.",
      },
    ],
    avoid: [
      "Starting with the hardest version of the habit.",
      "Relying on motivation or a free moment.",
      "Treating one missed day as failure and giving up.",
    ],
    nura:
      "Nura can be the cue and the tracking. Tell it the habit and when you want to do it, including routine times like \"after work\" (it asks once what that means for you and remembers), and it checks in daily, on weekdays or weekly by call, WhatsApp or in the app. If you're having a hard week, it shrinks the step instead of piling on.",
    faqs: [
      {
        q: "How long does it take to form a habit?",
        a: "It varies widely between people and habits. Focus on repeating a small version consistently rather than on a number of days.",
      },
      {
        q: "What if I keep forgetting?",
        a: "Tie it to a cue you never skip, and use a reminder that asks whether you did it rather than one you can dismiss.",
      },
    ],
    sources: [SRC.whatToAsk],
    related: ["how-to-stick-to-a-plan-after-a-doctors-appointment", "how-to-get-into-a-sleep-routine", "how-to-remember-to-take-medication"],
  },
  {
    slug: "how-to-get-into-a-sleep-routine",
    category: "routines",
    question: "How to get into a better sleep routine",
    title: "How to get into a better sleep routine",
    description:
      "Go to bed and get up at about the same time, wind down before bed, cut late caffeine and screens, and keep track so you can see what helps.",
    answer:
      "Go to bed and wake up at around the same time every day, give yourself time to relax before bed, avoid caffeine late in the day and put your phone away before sleep. If poor sleep keeps going despite changes, speak to a GP.",
    why:
      "The NHS's advice on sleep is simple: a regular routine helps your body get used to sleeping better. Doing it is harder. Late nights at the weekend, shift patterns, scrolling in bed and worry all pull the routine apart, and it's hard to tell which change is making a difference when you're tired every day. A few bad nights are usually nothing to worry about; it's the ongoing pattern that matters.",
    steps: [
      {
        title: "Fix your wake-up time first",
        body: "Getting up at the same time, including at weekends, is often easier to control than when you fall asleep.",
      },
      {
        title: "Set a wind-down",
        body: "The NHS suggests giving yourself time to relax before bed. Pick something calm you'll actually do.",
      },
      {
        title: "Move caffeine earlier",
        body: "The NHS suggests avoiding caffeine late in the day.",
      },
      {
        title: "Put the phone away",
        body: "Charge it outside the bedroom if you can.",
      },
      {
        title: "Make the bedroom comfortable",
        body: "Dark, quiet and a comfortable temperature, as far as you can manage.",
      },
      {
        title: "Keep a simple sleep note",
        body: "When you went to bed, roughly when you woke, how you felt the next day. After a couple of weeks you'll see what helps, and it's useful if you talk to a GP.",
      },
    ],
    avoid: [
      "Changing everything at once, so you can't tell what helped.",
      "Long lie-ins to catch up, which can make the next night harder.",
      "Ignoring months of poor sleep. The NHS says to speak to a GP if changing your habits doesn't help or you think you may have insomnia.",
    ],
    nura:
      "Nura can check in on your sleep routine at a time you choose and keep a note of how you're sleeping and feeling. If you connect Apple Health or Health Connect, Nura can read a daily sleep summary (only the types you allow) and may start a gentle check-in when your sleep has dropped well below your usual. It doesn't diagnose sleep problems; if poor sleep keeps going, talk to your GP.",
    faqs: [
      {
        q: "When should I see a GP about sleep?",
        a: "The NHS suggests speaking to a GP if changing your sleep habits doesn't help, or if you think you may have insomnia.",
      },
      {
        q: "Do weekends matter for a sleep routine?",
        a: "Yes. The NHS advises going to bed and waking up at around the same time each day.",
      },
    ],
    sources: [SRC.sleep],
    related: ["how-to-manage-stress-from-work", "how-to-build-a-new-health-habit", "how-to-keep-track-of-symptoms-between-appointments"],
  },
  {
    slug: "how-to-manage-stress-from-work",
    category: "routines",
    question: "How to manage work stress before it affects your health",
    title: "How to manage work stress",
    description:
      "Notice your own signs of stress, protect recovery time after work, keep one small daily habit going, and know when to talk to a GP.",
    answer:
      "Learn your own early signs of stress, protect some recovery time after work, keep one small habit that helps you (a walk, sleep, talking to someone), and see a GP if stress is affecting your health or you're worried about symptoms.",
    why:
      "The NHS describes stress as the body's reaction to feeling under pressure, and notes that long-term or severe stress can lead to exhaustion often called burnout. Work stress rarely stays at work: it shows up in sleep, appetite, headaches, mood and how much we drink or exercise. The trouble is that the habits that help are the first to go when work gets busy.",
    steps: [
      {
        title: "Know your signs",
        body: "The NHS lists signs such as irritability, feeling overwhelmed, racing thoughts, headaches, stomach problems and changes in eating, drinking or exercise. Which ones show up first for you?",
      },
      {
        title: "Separate the day from the evening",
        body: "A short walk, a change of clothes, ten minutes before you look at your phone. A small, fixed transition helps.",
      },
      {
        title: "Protect one habit",
        body: "Sleep, a walk, a meal you sit down for. Pick one and guard it on the busiest days.",
      },
      {
        title: "Write down what's weighing on you",
        body: "Getting it out of your head can make the next step clearer, and shows patterns over time.",
      },
      {
        title: "Talk to someone",
        body: "A friend, a colleague, your manager or occupational health if you have one. You decide what to raise and with whom.",
      },
      {
        title: "Know when to see a GP",
        body: "The NHS advises seeing a GP if you have symptoms you're worried about or feel you have more severe stress.",
      },
    ],
    avoid: [
      "Piling on coping strategies. One that you actually do is enough.",
      "Waiting for a quiet period that never comes.",
      "Ignoring physical symptoms because \"it's just stress\". Get anything worrying checked.",
    ],
    nura:
      "Nura can check in after your shift or working week, at a time you set, including \"after work\" (it asks once when that is and remembers). It asks how things felt and helps you pick one small step, without telling you what to do about your job. If you mention thoughts of self-harm or immediate danger, it tells you to contact emergency or crisis services straight away.",
    faqs: [
      {
        q: "What are the signs of stress?",
        a: "The NHS lists emotional signs like irritability, worry and feeling overwhelmed, physical ones like headaches, stomach problems and muscle pain, and changes in habits like eating, drinking or exercise.",
      },
      {
        q: "When should I see a GP about stress?",
        a: "If you have symptoms you're worried about, or feel your stress is more severe. In a crisis, call 999 (911 in the US) or NHS 111 in the UK.",
      },
    ],
    sources: [SRC.stress, SRC.nhs111],
    related: ["how-to-get-into-a-sleep-routine", "looking-after-yourself-as-a-carer", "how-to-build-a-new-health-habit"],
  },
  {
    slug: "what-is-a-care-and-support-plan",
    category: "routines",
    question: "What is a care and support plan, and how do you keep track of yours?",
    title: "What is a care and support plan?",
    description:
      "A council care and support plan sets out the support you need after an assessment. Here's what's in it, how to get one, and how to keep it working.",
    answer:
      "In England, a care and support plan is the written plan your local council produces after a needs or carer's assessment, setting out what support you need, how it will be given, and how much the council will spend. You should get a copy within a few weeks of the assessment.",
    why:
      "\"Care plan\" means different things in different places: the council's care and support plan, a hospital discharge care plan, or a plan a GP or specialist writes for a long-term condition. That's confusing when you're trying to find out what you're entitled to. The council plan matters because it's how support such as help at home, equipment or respite is arranged, and because it should be reviewed to check it's still working.",
    steps: [
      {
        title: "Get assessed",
        body: "Contact social services at your local council. A needs assessment is for people who need care; a carer's assessment is for people who care for someone. Both are free.",
      },
      {
        title: "Know what should be in the plan",
        body: "What's important to you, what you can do yourself, what equipment or care you need, what your family and friends think, who to contact with questions, your personal budget, and how and when care will happen. Carers' plans also cover respite and support groups.",
      },
      {
        title: "Get a copy",
        body: "The NHS says you should get a copy within a few weeks.",
      },
      {
        title: "Check it against real life",
        body: "Is the support happening as planned? Note what's working and what isn't, with dates.",
      },
      {
        title: "Use the reviews",
        body: "Plans are usually reviewed in the first few months and then once a year. If you're unhappy at any point, call adult social services and ask for a review.",
      },
    ],
    avoid: [
      "Leaving things out of the assessment because they seem small. The NHS notes that leaving things out might reduce the care recommended.",
      "Filing the plan away and never checking it against what's actually happening.",
      "Waiting for the annual review when something has clearly changed.",
    ],
    nura:
      "Nura's \"Care plans\" are something different: they're your own plans inside the app, made from what you tell Nura, that keep track of what matters and check in on next steps. They don't replace a council care and support plan or anything a clinician writes. They can help you keep track of one, though: tell Nura what your council plan says, or send a photo of it, and Nura can check in on whether the support is happening and remind you before a review.",
    faqs: [
      {
        q: "How often is a care and support plan reviewed?",
        a: "The NHS says usually within the first few months of support starting and then once a year. You can ask for a review at any time.",
      },
      {
        q: "Is a care and support plan the same as a hospital care plan?",
        a: "No. A council care and support plan follows a needs or carer's assessment. Hospitals produce a discharge care plan if you need more care after leaving hospital.",
      },
    ],
    sources: [SRC.careSupportPlans, SRC.needsAssessment, SRC.carerAssessment, SRC.discharge],
    related: ["looking-after-yourself-as-a-carer", "what-to-do-after-being-discharged-from-hospital", "how-to-check-on-an-elderly-parent-who-lives-alone"],
  },
];
