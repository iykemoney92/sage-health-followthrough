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
      "what-is-a-care-and-support-plan",
      "care-plan-for-elderly-parent-at-home",
      "types-of-care-plan",
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
      "what-is-a-care-and-support-plan",
      "care-plan-for-elderly-parent-at-home",
      "types-of-care-plan",
      "how-to-write-a-care-plan",
    ],
    media: media(
      IMG.describe,
      "Tell Nura what happened in your own words or a voice note, and it keeps it in one place for the review.",
    ),
    teaser: CARE_FOR_TEASER,
  },
];
