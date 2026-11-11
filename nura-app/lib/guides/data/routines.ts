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
    question: "What is a care and support plan, and when should it be reviewed?",
    title: "Care and support plans: a guide for carers",
    description:
      "What a council care and support plan includes, who can get one, when it should be reviewed, and how to keep it working for someone you look after.",
    answer:
      "In England, a care and support plan is the written plan your local council makes after a needs assessment or a carer's assessment. It sets out the support needed, how and when it will be given, and how much the council will spend. It's usually reviewed within the first few months of support starting and then once a year, and you can ask for a review at any time.",
    why:
      "\"Care plan\" means different things in different places: the council's care and support plan, a plan a hospital writes when someone leaves, or a plan a GP or specialist writes for a long-term condition. That makes it hard to know what you're entitled to. The council plan is the one that arranges practical support such as help at home, equipment, day centres or a break for the carer, and it only keeps working if someone checks it against what actually happens.",
    sections: [
      {
        heading: "Who can get a care and support plan?",
        paras: [
          "Anyone can ask their local council for a needs assessment, and it's free. If you look after someone, you can also ask for a carer's assessment for yourself: it's free for anyone over 18, it's separate from the assessment the person you care for might have, and you can ask for both to be done at the same time.",
          "After the assessment the council decides whether support is needed. If it is, the support is written up as a care and support plan, and you should get a copy within a few weeks. If the council decides you don't qualify, it should still give you free advice about help in your community. You'll usually also have a financial assessment, a means test, to work out whether you pay towards the cost.",
        ],
      },
      {
        heading: "What to include in a care and support plan",
        paras: ["The NHS says a care and support plan should cover:"],
        list: [
          "What's important to the person, and what they can still do themselves.",
          "The equipment or care they need, and how and when it will happen.",
          "What their family and friends think.",
          "Who to contact with questions about the care.",
          "The personal budget (the weekly amount the council will spend) and any direct payments.",
          "For a carer's plan: options for a break (respite), local support groups and training, such as how to lift safely.",
        ],
      },
      {
        heading: "When should a care plan be reviewed?",
        paras: [
          "The NHS says reviews usually happen within the first few months of support starting and then once a year. They check what's working, what isn't, and whether it's still the right support.",
          "You don't have to wait for the yearly review. If you're unhappy with the care at any point, call adult social services at the local council and ask for a review. Good reasons to ask: visits are late, short or missed; the person's needs have changed; equipment isn't working for them; or you, as the carer, can't keep up any more.",
        ],
      },
      {
        heading: "If you disagree with the assessment or the plan",
        paras: [
          "You have a right to complain. Start with your local council, which should have a formal complaints procedure on its website. If you're not happy with how the council handles it, you can go to the Local Government and Social Care Ombudsman, which looks into complaints independently. If explaining things is hard, an advocate can speak up for you and is often free.",
        ],
      },
    ],
    steps: [
      {
        title: "Ask for the assessments",
        body: "Contact adult social services at the local council. Ask for a needs assessment for the person who needs care and, if you look after them, a carer's assessment for you. Both are free, and you can ask for them at the same time.",
      },
      {
        title: "Prepare with real examples",
        body: "Write down everyday tasks that are hard, even small ones like turning taps. The NHS notes that leaving things out might reduce the care recommended. Have a friend or relative there to take notes if you can.",
      },
      {
        title: "Check the plan you're given",
        body: "Go through it against the list above: what matters to the person, what they can do, the care and equipment, who to contact, the budget and how and when care happens. Ask about anything missing.",
      },
      {
        title: "Keep a simple log",
        body: "Note when support turns up, what goes well and what doesn't, with dates. A few lines a week is enough, and it turns a vague worry into something a reviewer can act on.",
      },
      {
        title: "Use the reviews, and ask early if things change",
        body: "Bring your log to the first review and the yearly ones. If something changes in between, ring adult social services and ask for a review rather than waiting.",
      },
    ],
    avoid: [
      "Leaving things out of the assessment because they seem small. The NHS notes that leaving things out might reduce the care recommended.",
      "Going in alone if explaining things is hard. The NHS suggests taking a friend or relative, or using an advocate.",
      "Filing the plan away and never checking it against what's actually happening.",
      "Waiting for the yearly review when something has clearly changed.",
    ],
    nura:
      "Nura's Care plans are your own plans inside the app, not a council care and support plan, and they don't replace one. They help with the part councils can't do: noticing between reviews whether things are actually going well. If you look after someone, you can start a Care plan for them. Once they say yes on a link you send, Nura gives them a short phone call now and then, only in their daytime, asks how things are going and tells you how it went, and they can say \"stop\" on any call. You can also tell Nura what the council plan says, or attach a photo of it, and Nura checks in with you on whether the support is happening.",
    faqs: [
      {
        q: "How often is a care and support plan reviewed?",
        a: "The NHS says usually within the first few months of support starting and then once a year. You can ask for a review at any time.",
      },
      {
        q: "Who is eligible for a care and support plan?",
        a: "Anyone can ask for a free needs assessment, and any carer over 18 can ask for a carer's assessment. The council then decides whether support is needed and, if it is, writes the plan.",
      },
      {
        q: "Do you have to pay for the care in a care plan?",
        a: "Often you pay something. If the assessment finds support is needed, a financial assessment (means test) works out whether the council pays towards it.",
      },
      {
        q: "Is a care and support plan the same as a hospital care plan?",
        a: "No. A council care and support plan follows a needs or carer's assessment. A hospital writes its own plan if someone needs more care after leaving.",
      },
    ],
    sources: [SRC.careSupportPlans, SRC.needsAssessment, SRC.carerAssessment, SRC.meansTest, SRC.advocate, SRC.discharge],
    related: ["looking-after-yourself-as-a-carer", "how-to-check-on-an-elderly-parent-who-lives-alone", "daily-check-in-calls-for-elderly-parents", "caring-for-a-parent-from-a-distance"],
    media: {
      src: "/guides/try-plan-checking-in-on-mum.webp",
      width: 1000,
      height: 755,
      alt: "A plan Nura wrote from one sentence about a mum who lives alone: checking in on her remotely, with a suggested Saturday check-in asking how she's doing with eating and getting out for walks",
      caption: "A real plan from the try-it box on Nura's home page, written from one sentence: \"My mum lives on her own two hours away. I'd like to know she's eating properly and getting out for a walk most days.\"",
      link: { href: "/#try", label: "Try it with your own situation, no sign-up", cta: "try_first" },
    },
    teaser: {
      src: "/guides/someone-i-care-for.webp",
      width: 600,
      height: 1022,
      alt: "Nura's Care plan screen with \"Someone I care for\" chosen: Nura calls them, with their OK, and tells you how it went, only in their daytime",
      title: "Can't call every day? Nura can check in for you",
      body: "Choose \"Someone I care for\", add their name and number, and send them a link. Once they say yes, Nura gives them a short call now and then and tells you how it went.",
      href: "signup",
      label: "Start a Care plan free",
      cta: "care_for_someone",
    },
  },
];
