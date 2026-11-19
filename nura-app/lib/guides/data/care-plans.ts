import { SRC } from "../sources";
import type { Guide } from "../types";
import { CARE_FOR_TEASER, IMG, TRY_LINK, media } from "./media";

/**
 * Care plans, as families search for them. Search Console shows Nura already appearing for
 * "how to do a care plan", "how to write a care plan", "what does a care plan include" and
 * "care plan social services" (Oct–Nov 2026). Always separate the council's care and support
 * plan from a family's own plan, and never present Nura's Care plans as either a council or
 * a clinical plan.
 */
export const CARE_PLAN_GUIDES: Guide[] = [
  {
    slug: "how-to-write-a-care-plan",
    category: "care-plans",
    question: "How to write a care plan for a family member",
    title: "How to write a care plan for family",
    description:
      "A simple structure for a family care plan: what matters to them, daily routine, help needed, who does what, contacts, and when you'll review it.",
    answer:
      "Write it with the person, not about them. Cover what matters to them, what they can do themselves, the help they need and when, who provides each piece of help, the contacts everyone needs, what to do if something goes wrong, and when you'll look at it again. Keep it short enough that anyone stepping in can read it in five minutes.",
    why:
      "\"Care plan\" can mean a council's care and support plan, a plan a hospital writes when someone leaves, a clinical plan written by nurses, or a family's own plan. A family plan is the one nobody writes for you, yet it's what holds the week together: who's visiting Tuesday, who's doing the shopping, what Mum likes for lunch, who to call if she doesn't answer. If you're a nurse or care worker, your organisation's own format comes first; this guide is for families.",
    sections: [
      {
        heading: "What should a care plan include?",
        paras: [
          "A useful family care plan borrows from what the NHS says a council care and support plan should cover (what's important to the person, what they can still do, the care and equipment they need and how and when it happens, what family and friends think, and who to contact) and adds the practical detail families need:",
        ],
        list: [
          "About them: what matters to them, routines they like, things they don't want.",
          "What they can do themselves, so help doesn't take that away.",
          "Daily and weekly help: meals, shopping, medicines reminders, washing, getting out, company.",
          "Who does what, and when: family, friends, paid carers, services.",
          "Contacts: GP practice, pharmacy, care agency, neighbours with keys, council social services.",
          "Health notes they're happy to share, such as conditions and where their medicine list is kept.",
          "If something goes wrong: who to call, where the key is, alarm details.",
          "Review date.",
        ],
      },
      {
        heading: "What is the structure of a care plan?",
        paras: [
          "Most plans, family or professional, follow the same shape: the person and their goals, their needs, the actions or support for each need, who is responsible, and when it's reviewed. Writing it as a short table (need, what helps, who, when) is often clearer than paragraphs.",
        ],
      },
    ],
    steps: [
      {
        title: "Sit down with the person",
        body: "Ask what a good day looks like for them, what they find hard, and what they want help with. Write their words down.",
      },
      {
        title: "List the needs, one per line",
        body: "\"Shopping\", \"remembering tablets\", \"company in the afternoons\", \"getting to the club on Thursdays\".",
      },
      {
        title: "Put a name and a time next to each",
        body: "Gaps become obvious when a line has no name next to it.",
      },
      {
        title: "Add the contacts and the emergency plan",
        body: "Who has a key, the alarm details, and who to call first if they don't answer.",
      },
      {
        title: "Share it",
        body: "Everyone who helps should see the same version. Keep it somewhere easy to update.",
      },
      {
        title: "Set a review date",
        body: "Every few months, and after any fall, illness or hospital stay.",
      },
    ],
    avoid: [
      "Writing it about someone without asking them.",
      "A long document nobody reads. Short and current beats complete and out of date.",
      "Treating a family plan as a substitute for a council needs assessment if more help is needed.",
    ],
    nura:
      "Nura's Care plans are a simple place to keep a family plan going. You describe the situation in your own words and Nura drafts a plan with next steps and check-ins; you can change it as things move on, and invite siblings or a friend to see the same plan (never your private conversation with Nura). If the plan is about someone else and they agree, Nura can give them a short call in their daytime and tell you how it went. It isn't a council care and support plan or a clinical care plan, and it doesn't replace either.",
    faqs: [
      {
        q: "How do you write a care plan for an elderly parent?",
        a: "Start with what matters to them, list what they need help with, put a name and a time against each item, add contacts and an emergency plan, share it, and review it every few months.",
      },
      {
        q: "Is a family care plan the same as a council care plan?",
        a: "No. A council care and support plan follows a needs or carer's assessment and sets out the support the council arranges. A family plan covers everything else.",
      },
    ],
    sources: [SRC.careSupportPlans, SRC.needsAssessment, SRC.alarms],
    related: [
      "care-plan-example-for-an-elderly-parent",
      "what-should-a-care-plan-include",
      "what-is-a-care-and-support-plan",
      "care-plan-for-elderly-parent-at-home",
    ],
    media: media(
      IMG.tryMum,
      "A plan Nura drafted from one sentence about a mum who lives alone. You can try it with your own situation.",
      TRY_LINK,
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "care-plan-example-for-an-elderly-parent",
    category: "care-plans",
    question: "Care plan example for an elderly parent (free template)",
    title: "Care plan example for an elderly parent",
    description:
      "A filled-in example of a family care plan for a parent living alone, section by section, that you can copy and adapt.",
    answer:
      "Below is a worked example for a fictional parent, \"June, 81, lives alone, two hours from her children.\" It has six parts: about June, what she manages herself, the weekly help and who gives it, staying in touch, contacts and emergencies, and the review date. Copy the headings and replace the details with your own.",
    why:
      "Blank templates are easy to find but hard to fill in, because it isn't obvious how much detail to give or what \"needs\" should look like in practice. A worked example shows the level of detail that's actually useful: specific enough that a sibling or neighbour could step in, short enough to stay up to date.",
    sections: [
      {
        heading: "1. About June",
        paras: [
          "June, 81, widowed, lives alone in her own house. Loves her garden, the Thursday lunch club and phone calls with her grandchildren. Prefers mornings; tired by late afternoon. Doesn't want carers in the house every day, and wants to keep doing her own cooking for as long as she can.",
        ],
      },
      {
        heading: "2. What June manages herself",
        paras: [],
        list: [
          "Washing and dressing, cooking simple meals, light housework.",
          "Taking her tablets from a weekly pill organiser her pharmacy fills.",
          "Walking to the corner shop on good days.",
        ],
      },
      {
        heading: "3. Weekly help, and who gives it",
        paras: [],
        list: [
          "Online grocery delivery, Monday: daughter Sam orders it.",
          "Cleaner, Wednesday morning: paid privately.",
          "Lunch club, Thursday: neighbour Pat gives her a lift.",
          "Visit, every other Saturday: son Dev, alternating with Sam.",
          "Repeat prescription: ordered online by Sam, delivered by the pharmacy.",
        ],
      },
      {
        heading: "4. Staying in touch",
        paras: [],
        list: [
          "Short call most mornings around 10am: Sam on weekdays, Dev at weekends.",
          "Video call with the grandchildren on Sunday afternoons.",
          "If June sounds unwell, low, or mentions a fall: the caller tells the family group the same day.",
        ],
      },
      {
        heading: "5. Contacts and emergencies",
        paras: [],
        list: [
          "GP practice, pharmacy and council adult social services numbers.",
          "Neighbour Pat has a key; there's also a key safe (code shared with family only).",
          "June wears a pendant alarm that alerts Sam's and Dev's phones.",
          "If June doesn't answer by midday: try again, then ask Pat to knock. If no answer, call 999.",
        ],
      },
      {
        heading: "6. Review",
        paras: [
          "Look again in three months, or sooner after any fall, illness or hospital stay. If June starts struggling with washing, meals or getting out, ask the council for a needs assessment.",
        ],
      },
    ],
    steps: [
      {
        title: "Copy the six headings",
        body: "About them; what they manage; weekly help and who; staying in touch; contacts and emergencies; review.",
      },
      {
        title: "Fill it in together",
        body: "Use their words for what matters to them.",
      },
      {
        title: "Be specific",
        body: "Days, times and names. \"Someone checks in\" isn't a plan; \"Sam calls at 10am weekdays\" is.",
      },
      {
        title: "Agree the 'no answer' plan",
        body: "It's the part families most often skip, and the part that matters most on a bad day.",
      },
      {
        title: "Share one version",
        body: "Everyone works from the same copy, and you update it in one place.",
      },
    ],
    avoid: [
      "Copying a clinical template full of jargon. Families need plain language.",
      "Leaving out what the person can still do.",
      "Letting it go out of date after the first month.",
    ],
    nura:
      "You can write a plan like June's in Nura by describing the situation in a sentence or two; Nura drafts a Care plan with next steps and check-ins that you can change, and you can invite your siblings to see it. With your parent's agreement, Nura can also take one of the \"staying in touch\" calls: a short call in their daytime, with a summary sent to you afterwards. It doesn't replace a council care and support plan.",
    faqs: [
      {
        q: "What should be in a care plan for an elderly person living at home?",
        a: "What matters to them, what they manage themselves, the help they get and who gives it, how family keeps in touch, contacts and an emergency plan, and a review date.",
      },
      {
        q: "Can I use this as a council care plan?",
        a: "No. It's a family plan. Council care and support plans follow a needs assessment and are written by the council.",
      },
    ],
    sources: [SRC.careSupportPlans, SRC.alarms, SRC.needsAssessment],
    related: [
      "how-to-write-a-care-plan",
      "care-plan-for-elderly-parent-at-home",
      "how-to-share-the-care-of-a-parent-with-siblings",
      "what-is-a-care-and-support-plan",
    ],
    media: media(
      IMG.tryMum,
      "Nura drafts a starting plan from one sentence, like this one about a mum living alone. Try it with your own situation.",
      TRY_LINK,
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "care-plan-for-elderly-parent-at-home",
    category: "care-plans",
    question: "Care plan for an elderly parent at home: where to start",
    title: "Care plan for an elderly parent at home",
    description:
      "The two plans most families need (the council's and your own), how to get the council one, and how to keep both working week to week.",
    answer:
      "Most families need two things: a council care and support plan if your parent needs practical help (which starts with a free needs assessment), and a simple family plan that covers everything else, such as who visits, who calls and what happens if no one can reach them. Start by asking your parent what they want, then request the needs assessment if they're struggling with daily routines.",
    why:
      "When a parent starts needing more help at home, families are suddenly juggling councils, agencies, GP surgeries and each other. The council plan covers the support it arranges, but not who rings Mum on Tuesday or what to do if she doesn't answer. Without both pieces, things fall through the gaps.",
    sections: [
      {
        heading: "How do you get a care plan from the council?",
        paras: [
          "Ask adult social services at your parent's local council for a needs assessment. It's free and anyone can ask. If your parent is eligible for support, the council writes a care and support plan, and you should get a copy within a few weeks. A financial assessment (means test) works out whether your parent pays towards it. If you help them, you can ask for a carer's assessment for yourself at the same time.",
        ],
      },
      {
        heading: "What does a care plan for an elderly person at home usually cover?",
        paras: [
          "The NHS says a council care and support plan should cover what's important to the person, what they can still do, the care and equipment they need and how and when it happens, what family and friends think, who to contact, and the personal budget. A family plan adds the everyday detail: routines, who does what, staying in touch, and the emergency plan.",
        ],
      },
    ],
    steps: [
      {
        title: "Talk to your parent",
        body: "What do they want help with, and what do they want to keep doing themselves?",
      },
      {
        title: "Request a needs assessment",
        body: "If they're finding washing, dressing, meals or getting out hard, contact adult social services.",
      },
      {
        title: "Prepare with real examples",
        body: "The NHS notes that leaving things out might reduce the care recommended, so describe a normal day honestly.",
      },
      {
        title: "Write the family plan alongside",
        body: "Who calls, who visits, who handles prescriptions, and the plan if no one can reach them.",
      },
      {
        title: "Keep a short log",
        body: "When help turns up, what's going well and what isn't. It makes reviews far more useful.",
      },
      {
        title: "Ask for a review when things change",
        body: "Don't wait for the yearly review if visits are being missed or needs have changed.",
      },
    ],
    avoid: [
      "Assuming the council plan covers everything families need to coordinate.",
      "Leaving things out of the assessment because they seem minor.",
      "Filing the plan and never checking it against what's happening.",
    ],
    nura:
      "Nura helps with the family side and with noticing how things are actually going. You can keep notes and next steps in a Care plan, invite siblings to the same plan, and, with your parent's agreement, have Nura give them a short call in their daytime and tell you how it went. You can also tell Nura what the council plan says, or attach a photo of it, and Nura checks in with you on whether the support is happening. It isn't a council care plan and doesn't arrange care.",
    faqs: [
      {
        q: "Who writes a care plan for an elderly person at home?",
        a: "The council writes a care and support plan after a needs assessment if support is needed. Families often keep their own plan for everything else.",
      },
      {
        q: "How long does it take to get a council care plan?",
        a: "The NHS says you should get a copy of your care and support plan within a few weeks of the assessment.",
      },
    ],
    sources: [SRC.careSupportPlans, SRC.needsAssessment, SRC.meansTest, SRC.carerAssessment, SRC.homecare],
    related: [
      "what-is-a-care-and-support-plan",
      "how-to-write-a-care-plan",
      "how-to-get-help-at-home-for-an-elderly-parent",
      "care-plan-review-questions",
    ],
    media: media(
      IMG.checksInWithMargaret,
      "A Care plan about a parent in Nura. Once she says yes, Nura calls her in her daytime and tells you how it went.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "types-of-care-plan",
    category: "care-plans",
    question: "What are care plans? The main types explained",
    title: "What are care plans? The main types",
    description:
      "Council care and support plans, carer's plans, hospital discharge plans, personalised care plans and family plans: what each is and who writes it.",
    answer:
      "A care plan is a written plan setting out someone's needs and the support that meets them. The main types are: the council's care and support plan (after a needs assessment), a carer's support plan (after a carer's assessment), the plan a hospital makes when someone needs more care after leaving, personalised care plans that health professionals agree with people who have long-term conditions, and the informal plans families keep themselves.",
    why:
      "People hear \"care plan\" from social workers, nurses, hospitals and care homes and assume it's all one document. It isn't, and the differences matter: they're written by different people, for different reasons, and you ask for reviews or changes in different places. Knowing which one you're dealing with tells you who to call.",
    sections: [
      {
        heading: "What is a care plan in health and social care?",
        paras: ["The main kinds:"],
        list: [
          "Care and support plan (social care): written by the local council after a needs assessment if support is needed. Covers the care, equipment, personal budget and who to contact. Usually reviewed within the first few months, then yearly.",
          "Carer's support plan: written after a carer's assessment if the carer qualifies, for example covering breaks and practical help.",
          "Hospital discharge plan: when someone is leaving hospital and needs more care, the NHS says a plan is made covering things like support at home.",
          "Personalised care plan: agreed between a person and their health professionals, often for a long-term condition.",
          "Care home care plan: each resident's plan for their daily care, written by the home.",
          "Family care plan: informal, written by the family, covering routines, who does what and emergencies.",
        ],
      },
      {
        heading: "Who can see or change a care plan?",
        paras: [
          "The person the plan is about should be involved and get a copy of formal plans. For a council plan, ask adult social services for a review at any time if things change. For a hospital or health plan, ask the team that wrote it. If explaining things is hard, the NHS notes an advocate can speak up for you and is often free.",
        ],
      },
    ],
    steps: [
      {
        title: "Work out which plan you have",
        body: "Look at who wrote it: the council, a hospital, a GP or specialist team, a care home, or your family.",
      },
      {
        title: "Get a copy",
        body: "You, or the person it's about, should have one for any formal plan.",
      },
      {
        title: "Check it against real life",
        body: "Is the support in the plan actually happening?",
      },
      {
        title: "Know who to ask for changes",
        body: "Council plans: adult social services. Health plans: the team that wrote them.",
      },
      {
        title: "Keep a family plan for the gaps",
        body: "Formal plans rarely cover who calls, who visits and what to do if no one can reach someone.",
      },
    ],
    avoid: [
      "Assuming one plan covers everything.",
      "Not asking for a copy.",
      "Waiting for a scheduled review when something has clearly changed.",
    ],
    nura:
      "In Nura, a \"Care plan\" is your own plan inside the app, about you or someone you look out for. It holds notes and next steps and comes with check-ins at times you choose, by app, WhatsApp or short call. If it's about someone else and they agree, Nura can call them in their daytime and tell you how it went. It isn't a council, hospital or clinical care plan and doesn't replace one.",
    faqs: [
      {
        q: "What is the purpose of a care plan?",
        a: "To set out someone's needs and the support that meets them, so everyone involved knows what's meant to happen and it can be checked and reviewed.",
      },
      {
        q: "Is a care plan a legal document?",
        a: "A council care and support plan is part of the council's formal process, and you can complain if you disagree with it. Family plans are informal.",
      },
    ],
    sources: [SRC.careSupportPlans, SRC.carerAssessment, SRC.discharge, SRC.advocate],
    related: [
      "what-is-a-care-and-support-plan",
      "how-to-write-a-care-plan",
      "care-plan-review-questions",
      "care-plan-for-elderly-parent-at-home",
    ],
    media: media(
      IMG.tryMum,
      "A Nura Care plan is your own plan, drafted from your words. This one is from the try-it box on the home page.",
      TRY_LINK,
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "care-plan-review-questions",
    category: "care-plans",
    question: "Care plan review: questions to ask and how to prepare",
    title: "Care plan review: questions to ask",
    description:
      "What happens at a care plan review, the questions worth asking, what to bring, and how to ask for a review early when things change.",
    answer:
      "A care plan review checks what's working, what isn't, and whether the support is still right. Bring specific examples (dates when visits were late or missed, things that have got harder) and ask: is the plan still meeting their needs, what's changed, is the budget right, what happens next, and who do we call in between. The NHS says reviews usually happen in the first few months and then yearly, and you can ask for one at any time.",
    why:
      "Reviews often come round when nobody has prepared, and they turn into a quick \"everything OK?\" that changes nothing. Meanwhile families have spent months noticing small problems that never got written down. A little preparation turns a review into the moment things actually improve.",
    sections: [
      {
        heading: "Questions to ask at a care plan review",
        paras: [],
        list: [
          "Is the support in the plan actually happening, at the times it says?",
          "What's got harder since the last review, and what's got easier?",
          "Are the person's own goals and preferences still reflected?",
          "Is any equipment not working for them?",
          "Is the personal budget or direct payment enough for what's needed?",
          "Is the carer coping? (If not, ask for a carer's assessment or a review of it.)",
          "Who do we contact if things change before the next review?",
          "When is the next review?",
        ],
      },
      {
        heading: "When should you ask for a review early?",
        paras: [
          "The NHS says you can call adult social services and ask for a review at any time if you're unhappy with the care. Good reasons include visits being late, short or missed; a fall, illness or hospital stay; the person's needs changing; or the carer no longer being able to keep up.",
        ],
      },
    ],
    steps: [
      {
        title: "Re-read the current plan",
        body: "Note what it says should happen.",
      },
      {
        title: "Gather examples",
        body: "Dates and specifics from the last few months. A short log is ideal.",
      },
      {
        title: "Ask the person what they think",
        body: "Their view should lead the review.",
      },
      {
        title: "Write your questions down",
        body: "Use the list above and add your own.",
      },
      {
        title: "Have someone with you",
        body: "A relative to take notes, or an advocate if explaining things is hard.",
      },
      {
        title: "Get the outcome in writing",
        body: "Ask for the updated plan and the next review date.",
      },
    ],
    avoid: [
      "Arriving without examples.",
      "Leaving out the carer's side of things.",
      "Leaving without knowing what changes and when.",
    ],
    nura:
      "Nura makes the log easy. Tell it how things went in a sentence or a voice note and it keeps your notes in a Care plan; if your parent agrees to calls, Nura gives them a short call in their daytime and sends you a summary each time. By the review you have a record of how things have actually been going, not just a memory of the last bad week.",
    faqs: [
      {
        q: "How often should a care plan be reviewed?",
        a: "The NHS says usually within the first few months of support starting and then once a year, and you can ask for one at any time.",
      },
      {
        q: "What if I disagree with the outcome of a review?",
        a: "Use the council's complaints procedure, and if you're still unhappy, the Local Government and Social Care Ombudsman.",
      },
    ],
    sources: [SRC.careSupportPlans, SRC.carerAssessment, SRC.advocate],
    related: [
      "when-should-a-care-plan-be-reviewed",
      "what-is-a-care-and-support-plan",
      "care-plan-for-elderly-parent-at-home",
      "types-of-care-plan",
    ],
    media: media(
      IMG.describe,
      "Tell Nura what happened in your own words or a voice note, and it keeps it in one place for the review.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "when-should-a-care-plan-be-reviewed",
    category: "care-plans",
    question: "When should a care plan be reviewed?",
    title: "When should a care plan be reviewed?",
    description:
      "Council care plans: within the first few months, then once a year, and any time you ask. What should prompt an early review, and how to request one.",
    answer:
      "In England, a council care and support plan is usually reviewed within the first few months of support starting and then once a year, according to the NHS. You don't have to wait for that date: if you're unhappy with the care at any time, you can call adult social services at the local council and ask for a review. A family's own care plan has no set timetable, so look at it every few months and straight after any fall, illness or hospital stay.",
    why:
      "The yearly review is easy to treat as the only one. In practice a year is a long time in someone's care: a parent gets slower on the stairs, a paid carer's visits drift later, the person doing most of the caring gets worn down. None of that waits for the anniversary of the plan, and nobody at the council knows about it unless someone says so. Knowing that you can ask at any time, and what to say when you do, is what keeps a plan matched to real life.",
    sections: [
      {
        heading: "The usual review timetable",
        paras: ["For a council care and support plan in England, the NHS describes it like this:"],
        list: [
          "First review: usually within the first few months of support starting.",
          "After that: usually once every year.",
          "In between: at any time, if you're unhappy with the care and ask for one.",
          "Money is checked separately: the council must regularly reassess your finances, usually once a year.",
        ],
      },
      {
        heading: "What a review looks at",
        paras: [
          "The NHS says reviews check what's working, what isn't working, and whether the plan is still the best support for the person. That covers the support itself, how and when it happens, any equipment, and, for a carer's plan, whether the breaks and help set out for the carer are really happening.",
        ],
      },
      {
        heading: "Changes worth asking for an early review over",
        paras: ["You don't need a special reason beyond being unhappy with the care. These are the situations families most often ring about:"],
        list: [
          "Visits from paid carers are regularly late, cut short or missed.",
          "A fall, an illness or a stay in hospital.",
          "Everyday tasks have got harder: washing, dressing, cooking, getting out.",
          "Equipment in the plan isn't working for them, or never arrived.",
          "The person's own wishes have changed.",
          "The main carer can't keep up any more, or their own health or work has changed.",
          "Someone has moved in or out, or a relative who helped has moved away.",
        ],
      },
      {
        heading: "How to ask for a review",
        paras: [
          "Call adult social services at the local council and say you'd like a review of the care and support plan. Give the person's name, say what has changed, and have two or three dated examples ready. Ask when the review will happen and who will be in touch.",
          "If you're not happy with how an assessment or plan was done, the NHS says you have a right to complain: first to the council, through the complaints procedure on its website, and then to the Local Government and Social Care Ombudsman if you're unhappy with how the council handles it.",
        ],
      },
      {
        heading: "How often to review a family care plan",
        paras: [
          "A plan the family wrote for itself has no rule. Every few months works for most families, plus a quick look whenever something changes. Ask three things with the person it's about: what's working, what isn't, and what do we want to change. Then update the names and times, so the plan still says who does what.",
        ],
      },
    ],
    steps: [
      {
        title: "Find the date of the last review",
        body: "It's usually on the plan itself. If support started months ago and nobody has been in touch, ask the council when the first review is due.",
      },
      {
        title: "Keep a short log",
        body: "A line a day or a line a week: what happened, what was missed, what got harder. Dates turn a general worry into something a reviewer can act on.",
      },
      {
        title: "Ask the person what they think",
        body: "The plan is theirs. What they want to keep, stop or change should lead the conversation.",
      },
      {
        title: "Ring adult social services if it can't wait",
        body: "Say you're unhappy with the care, or that needs have changed, and ask for a review now.",
      },
      {
        title: "Take someone with you",
        body: "A relative to take notes, or an advocate if explaining things is hard. Advocates are often free.",
      },
      {
        title: "Get the updated plan in writing",
        body: "Ask what changes, from when, and when the next review will be.",
      },
    ],
    avoid: [
      "Waiting for the yearly review when something has clearly changed.",
      "Saying \"it's all fine\" on the day because the last week happened to be a good one.",
      "Assuming the council knows about missed visits. Often it only finds out when you say so.",
      "Reviewing the plan without the person it's about.",
    ],
    nura:
      "Nura helps with the months between reviews. You keep a Care plan in your own words, and Nura checks in with you about how things are going; you can tell it what the council plan says, or attach a photo of it, and it checks in on whether the support is happening. If the plan is about someone else and they agree on a link you send, Nura gives them a short call in their daytime and tells you how it went. By the time a review comes round, or you decide to ask for one early, you have a record to bring. Nura's Care plans are your own plans; they aren't a council care and support plan and don't replace one.",
    faqs: [
      {
        q: "How often should a care plan be reviewed?",
        a: "For a council care and support plan in England, the NHS says usually within the first few months of support starting and then once every year. A family's own plan is worth reviewing every few months and after any big change.",
      },
      {
        q: "Can I ask for a care plan review at any time?",
        a: "Yes. The NHS says that if at any time you're unhappy with your care, you can call adult social services at your local council and ask for a review.",
      },
      {
        q: "Who reviews a care and support plan?",
        a: "The local council's adult social services, which wrote the plan, with the person it's for. Family, a friend or an advocate can be there too.",
      },
      {
        q: "What about a care plan from a care home, hospital or nurse?",
        a: "Those are the provider's or clinical team's own plans and they set their own review dates. Ask them how often they review it and how you can ask for one sooner.",
      },
    ],
    sources: [SRC.careSupportPlans, SRC.meansTest, SRC.advocate],
    related: [
      "care-plan-review-questions",
      "what-is-a-care-and-support-plan",
      "what-should-a-care-plan-include",
      "who-can-get-a-care-plan",
    ],
    media: media(
      IMG.describe,
      "Tell Nura how things have been going, in your own words or a voice note, so there's a record ready when a review comes round.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "what-should-a-care-plan-include",
    category: "care-plans",
    question: "What should a care plan include?",
    title: "What should a care plan include? A checklist",
    description:
      "The eight things the NHS says a council care and support plan covers, what a carer's plan adds, and what to put in a family's own care plan.",
    answer:
      "A council care and support plan in England sets out the type of support you need, how it will be given, and how much the council will spend. The NHS lists eight things it includes: what's important to you, what you can do yourself, the equipment or care you need, what your friends and family think, who to contact with questions, your personal budget and direct payments, the care you can get from the council, and how and when care will happen. A family's own plan covers the same ground, plus who does what.",
    why:
      "Most people only see a care plan once it has been written, and it's hard to tell what's missing from a document you've never seen before. A plan can look complete and still leave out the things that decide whether a week works: who to ring when a visit is missed, what the person can and wants to do for themselves, when anyone will check it again. A checklist lets you read a plan properly, or write one that someone else can pick up and use.",
    sections: [
      {
        heading: "What a council care and support plan includes",
        paras: ["According to the NHS, care and support plans include:"],
        list: [
          "What's important to you.",
          "What you can do yourself.",
          "What equipment or care you need.",
          "What your friends and family think.",
          "Who to contact if you have questions about your care.",
          "Your personal budget and direct payments: the weekly amount the council will spend on your care.",
          "What care you can get from your local council.",
          "How and when care will happen.",
        ],
      },
      {
        heading: "What a carer's plan adds",
        paras: ["If you're a carer and the plan follows a carer's assessment, the NHS says it will also include:"],
        list: [
          "Respite care options, so you can take a break.",
          "Details of local support groups.",
          "Training, such as how to lift safely.",
        ],
      },
      {
        heading: "What to put in a family care plan",
        paras: [
          "A family's own plan isn't an official document, so it can be as short as a page. These headings cover what people stepping in need to know:",
        ],
        list: [
          "About them: what matters to them, the routines they like, what they don't want.",
          "What they do for themselves, so help doesn't take it away.",
          "Help needed through the week: meals, shopping, reminders, washing, getting out, company.",
          "Who does each thing, and when.",
          "Contacts: GP practice, pharmacy, care agency, a neighbour with a key, council social services.",
          "What to do if something goes wrong: who to call first, where the key is, alarm details.",
          "The date you'll look at it again.",
        ],
      },
      {
        heading: "What does a care plan look like?",
        paras: [
          "There's no single form. A council plan is a written document, and the NHS says you should get a copy within a few weeks of the assessment. A family plan often works best as a short table with four columns: the need, what helps, who does it, and when. If a line has no name or no time next to it, that's the gap to sort out.",
        ],
      },
    ],
    steps: [
      {
        title: "Get a copy of the plan",
        body: "If the council has written one and you haven't seen it, ask adult social services for a copy.",
      },
      {
        title: "Tick it off against the list",
        body: "Go through the eight items above. Note anything that's missing or vague, such as care with no days or times.",
      },
      {
        title: "Check it against a real week",
        body: "Does what the plan says should happen actually happen, at the times it says?",
      },
      {
        title: "Ask for what's missing",
        body: "Call adult social services and ask for the gaps to be filled in, or for a review if the plan no longer fits.",
      },
      {
        title: "Write the family plan for everything else",
        body: "The lifts, the shopping, the phone calls: put a name and a time against each.",
      },
    ],
    avoid: [
      "Assuming a plan is complete because it's long.",
      "Leaving out what the person can still do for themselves.",
      "A plan with no contact name and no review date.",
      "Treating a family plan as a replacement for a needs assessment when more help is needed.",
    ],
    nura:
      "Nura's Care plans are a simple way to keep a family plan in one place. You describe the situation in your own words and Nura drafts a plan with next steps and check-ins, which you can change as things move on. You can invite siblings or a friend to see the same plan (never your private conversation with Nura), and if the plan is about someone else and they agree, Nura can give them a short call in their daytime and tell you how it went. It isn't a council care and support plan or a clinical care plan, and it doesn't replace either.",
    faqs: [
      {
        q: "What are the main parts of a care plan?",
        a: "What matters to the person, what they can do themselves, the care or equipment they need, how and when it happens, who to contact, and, for a council plan, the personal budget. A family plan adds who does what.",
      },
      {
        q: "Does a care plan include the cost?",
        a: "A council care and support plan does. The NHS says it covers how much money the council will spend on your care and whether you'd be expected to contribute towards the cost.",
      },
      {
        q: "Do I get a copy of the care plan?",
        a: "Yes. The NHS says the support you need is written up as a care and support plan and you should get a copy within a few weeks.",
      },
      {
        q: "Is this the same as a nursing care plan?",
        a: "No. A nursing or clinical care plan is written by healthcare staff in their own format. This guide is about council care and support plans and families' own plans.",
      },
    ],
    sources: [SRC.careSupportPlans, SRC.carerAssessment, SRC.needsAssessment],
    related: [
      "how-to-write-a-care-plan",
      "care-plan-example-for-an-elderly-parent",
      "when-should-a-care-plan-be-reviewed",
      "what-is-a-care-and-support-plan",
    ],
    media: media(
      IMG.tryMum,
      "A plan Nura drafted from one sentence about a mum who lives alone. You can try it with your own situation.",
      TRY_LINK,
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "who-can-get-a-care-plan",
    category: "care-plans",
    question: "Who is eligible for a care plan?",
    title: "Who is eligible for a care plan?",
    description:
      "Anyone can ask their council for a free needs assessment, and carers over 18 for a carer's assessment. What decides whether you then get a care plan.",
    answer:
      "In England, a council care and support plan follows an assessment, and the NHS says anyone can ask for one. A needs assessment is free and open to anyone who needs help to cope day to day. A carer's assessment is free for anyone over 18 who looks after someone. If the council decides you qualify for support, it writes that support up as a care and support plan. Savings don't stop you being assessed; a separate means test works out who pays.",
    why:
      "People rule themselves out before they ask. They assume you have to be a certain age, have a diagnosis, live alone or have no savings. None of those is the test. The assessment looks at how you're managing everyday life, or, for carers, what caring is doing to yours. The other reason it's confusing is that asking is open to everyone, but getting council support depends on what the assessment finds, and paying for it depends on a third thing, the financial assessment.",
    sections: [
      {
        heading: "Two routes to a care and support plan",
        paras: ["The NHS describes two types of assessment, and either can lead to a plan:"],
        list: [
          "A needs assessment, if you need care yourself. It's free and anyone can ask for one, including on behalf of someone they know.",
          "A carer's assessment, if you care for someone else. It's free and anyone over 18 can ask. It's separate from the needs assessment of the person you look after, but you can ask for both at the same time.",
        ],
      },
      {
        heading: "What the council looks at",
        paras: [
          "In a needs assessment, someone from the council, such as a social worker or occupational therapist, asks how you're managing everyday tasks like washing, dressing and cooking. It can be face to face, over the phone or online, or a self-assessment.",
          "In a carer's assessment, they ask how you're coping with caring, including how it affects your physical and mental health, work, free time and relationships. The NHS says these usually last at least an hour.",
          "Afterwards the council decides whether you need help and tells you the result. If you qualify, the support is written up as a care and support plan, and you should get a copy within a few weeks.",
        ],
      },
      {
        heading: "Does money affect whether you're eligible?",
        paras: [
          "Not for the assessment itself. If it finds you need help, a financial assessment (means test) is arranged for you to see whether the council will pay towards it. The NHS says that in England the council generally helps with care costs if you have savings of less than £23,250, and that you'll generally be expected to pay something towards the cost of social care.",
          "For care at home, the NHS says the value of your house isn't included in the financial assessment.",
        ],
      },
      {
        heading: "If you're told you don't qualify",
        paras: [
          "The council should still give you free advice about where to get help in your community; the NHS says to ask if that doesn't happen. If you disagree with the result or how the assessment was done, you have a right to complain, first to the council and then to the Local Government and Social Care Ombudsman.",
        ],
      },
      {
        heading: "A family care plan has no eligibility test",
        paras: [
          "Whatever the council decides, nothing stops a family writing its own plan: what the person needs, who helps with what, and who to call. It's often what covers the gaps while you wait for an assessment, and what holds the week together afterwards.",
        ],
      },
    ],
    steps: [
      {
        title: "Contact social services at the local council",
        body: "Ask for a needs assessment, a carer's assessment, or both. You can call or do it online.",
      },
      {
        title: "Write down the everyday detail",
        body: "List every task that's a struggle, even small ones like turning taps. The NHS notes that leaving things out might reduce the care recommended.",
      },
      {
        title: "Have someone with you",
        body: "A friend or relative can help explain and take notes. If that isn't possible, an advocate can speak up for you, and they're often free.",
      },
      {
        title: "Get the result",
        body: "The council tells you whether you qualify. If you do, ask when you'll receive the care and support plan.",
      },
      {
        title: "Expect the financial assessment",
        body: "It's arranged for you after the assessment. Have details of income, savings and benefits ready.",
      },
      {
        title: "If the answer is no, ask what else there is",
        body: "Ask for the free advice about local help, and use the complaints procedure if you think the assessment was wrong.",
      },
    ],
    avoid: [
      "Not asking because you assume you won't qualify. Asking is free and open to anyone.",
      "Playing things down on the day. Describe a bad day as well as a good one.",
      "Forgetting the carer's assessment. The person doing the caring can be assessed too.",
      "Spending or giving away money before the means test. The NHS says the assessment can ask about things you used to own.",
    ],
    nura:
      "Nura can't assess anyone or arrange council support, and its Care plans aren't a council care and support plan. What it does is keep your own plan going in the meantime. You describe the situation in your own words and Nura drafts a plan with next steps and check-ins, which makes it easier to notice, and have written down, what's getting harder before an assessment. If you look after someone and they agree on a link you send, Nura gives them a short call in their daytime and tells you how it went.",
    faqs: [
      {
        q: "Do you have to be over 65 to get a care plan?",
        a: "No. The NHS says the needs assessment is free and anyone can ask for one. A carer's assessment is for anyone over 18 who cares for someone.",
      },
      {
        q: "Can I get a care plan if I have savings?",
        a: "You can still be assessed. Savings affect who pays: the NHS says that in England the council generally helps with care costs if you have savings of less than £23,250.",
      },
      {
        q: "Is a needs assessment free?",
        a: "Yes. The NHS says the needs assessment is free and anyone can ask for one. A carer's assessment and the financial assessment are free too.",
      },
      {
        q: "Can I ask for an assessment for my parent?",
        a: "Yes. The NHS says to get a needs assessment if you think you, or someone you know, needs help to cope day to day. Talk to your parent first, and be there for the assessment if they'd like you to be.",
      },
    ],
    sources: [SRC.careSupportPlans, SRC.needsAssessment, SRC.carerAssessment, SRC.meansTest, SRC.advocate],
    related: [
      "what-is-a-care-and-support-plan",
      "what-is-a-carers-assessment",
      "how-to-get-help-at-home-for-an-elderly-parent",
      "what-should-a-care-plan-include",
    ],
    media: media(
      IMG.checksInWithMargaret,
      "A Nura Care plan for someone you look after is your own plan: Nura calls them, with their OK, and tells you how it went.",
    ),
    teaser: CARE_FOR_TEASER,
  },
];
