import { SRC } from "../sources";
import type { Guide } from "../types";

export const CARING_GUIDES: Guide[] = [
  {
    slug: "how-to-check-on-an-elderly-parent-who-lives-alone",
    category: "caring",
    question: "How to check on an elderly parent who lives alone",
    title: "How to check on a parent who lives alone",
    description:
      "Agree a rhythm of contact with them, share the load with others, look into alarms and council support, and know what to do if you can't reach them.",
    answer:
      "Agree with them how and when you'll be in touch, share the checking between family, friends or neighbours so it doesn't all fall on you, look at personal alarms and a council needs assessment if they need more help, and have a plan for what happens if no one can reach them.",
    why:
      "The worry is usually two things at once: wanting to know they're all right, and not wanting to smother them. Daily phone calls start well and turn into a chore for both of you, or into a test they feel they have to pass. And when everything depends on one person ringing, a single busy day leaves a gap. The parent's own view matters most; it's their home and their independence.",
    steps: [
      {
        title: "Talk to them first",
        body: "Ask what they'd find reassuring rather than intrusive. Some people like a morning call; others would rather a text, or a visit twice a week.",
      },
      {
        title: "Set a rhythm, not a test",
        body: "Agree a regular time for contact. A routine makes it easier to notice when something's off, without it feeling like an inspection.",
      },
      {
        title: "Share it out",
        body: "Siblings, grandchildren, friends, a neighbour. Write down who checks when, so there are no gaps and no one burns out.",
      },
      {
        title: "Look at alarms and telecare",
        body: "The NHS describes personal alarms (including ones that alert a family member's phone, or a 24-hour monitoring service) and sensors that can alert family or carers. Some councils provide basic monitoring services.",
      },
      {
        title: "Ask about a needs assessment",
        body: "If they're struggling day to day, a council needs assessment is free and anyone can ask for one. It's the route to things like equipment or help at home.",
      },
      {
        title: "Plan for \"no answer\"",
        body: "Agree who will try next, who has a key (the NHS mentions key safes for family, carers and emergency services), and when you'd call for help.",
      },
    ],
    avoid: [
      "Making every call about health. They'll start dreading it, and you'll hear less.",
      "Installing cameras or tracking without their agreement.",
      "Carrying it alone until you can't.",
    ],
    nura:
      "Nura can do some of the regular checking for you. You create a Care plan about your parent with their first name and number, and Nura only starts calling after they agree, by tapping Yes on a link you send or by you confirming on their behalf that they're happy to be called. Calls happen in their daytime and you get a short summary of each. They can say \"stop\" on any call. You can also invite siblings to the same Care plan so everyone sees how things are going.",
    faqs: [
      {
        q: "How often should I check on an elderly parent?",
        a: "There's no single right answer. Agree it with them, and base it on how they're managing and what they find reassuring rather than intrusive.",
      },
      {
        q: "What help can the council give?",
        a: "In England, a council needs assessment is free and can lead to equipment, home adaptations or help at home. Some councils also provide basic monitoring services.",
      },
    ],
    sources: [SRC.alarms, SRC.needsAssessment],
    related: ["daily-check-in-calls-for-elderly-parents", "caring-for-a-parent-from-a-distance", "how-to-share-the-care-of-a-parent-with-siblings"],
  },
  {
    slug: "daily-check-in-calls-for-elderly-parents",
    category: "caring",
    question: "Daily check-in calls for elderly parents: how they work",
    title: "Daily check-in calls for elderly parents",
    description:
      "What a check-in call service does, what to ask before choosing one, why consent matters, and how it fits alongside alarms and family contact.",
    answer:
      "A check-in call service rings your parent at an agreed time, has a short conversation about how they are, and lets you know how it went. It's a complement to family contact and alarms, not a replacement for them or for emergency services.",
    why:
      "Families look for check-in calls when they can't ring every day themselves but want to know someone has. The options vary a lot: volunteer befriending calls, automated reminder calls, alarm services, and AI calls. What matters most isn't the technology but three questions: does your parent agree to it, what happens to what they say, and what happens if something is wrong.",
    steps: [
      {
        title: "Ask your parent",
        body: "A call they didn't agree to will feel like a stranger checking up on them. Explain what it is and let them decide.",
      },
      {
        title: "Decide what the call is for",
        body: "Company, a medication prompt, a check on how they're feeling, or all three. Different services are good at different things.",
      },
      {
        title: "Check what you'll be told",
        body: "A summary after each call? An alert if a call isn't answered? Make sure it fits what you need to know, and that your parent knows what you'll see.",
      },
      {
        title: "Check privacy",
        body: "Are calls recorded? Who can hear or read them? How does your parent stop the calls?",
      },
      {
        title: "Know what it isn't",
        body: "A check-in call is not an emergency service. For falls or emergencies, the NHS describes personal alarms that can alert family or a 24-hour monitoring service.",
      },
      {
        title: "Keep in touch yourself",
        body: "The call takes the daily load; it doesn't replace hearing from family.",
      },
    ],
    avoid: [
      "Signing a parent up without telling them.",
      "Treating an unanswered call as an emergency system. Agree separately what you'll do if you can't reach them.",
      "Choosing a service whose summaries you'll never read.",
    ],
    nura:
      "This is Nura's \"check in on someone you care for\". You add a Care plan about your parent with their first name, relationship, phone number and time zone. Nura only calls after they agree: they tap Yes on a link you send, or you confirm on their behalf (which you should only do if they know about Nura and are happy to be called). Calls happen in their daytime, may be recorded and transcribed so Nura can keep track, and you get a short summary of each call. Nothing you've told Nura privately is read out to them, and they can say \"stop\" on any call to end the calls.",
    faqs: [
      {
        q: "Does my parent need a smartphone for check-in calls?",
        a: "For Nura's calls, no; they're phone calls to the number you add. Your parent doesn't need a Nura account.",
      },
      {
        q: "Can a check-in call replace a personal alarm?",
        a: "No. A scheduled call can't respond to a fall between calls. Personal alarms and telecare are designed for that.",
      },
    ],
    sources: [SRC.alarms, SRC.medicinesForCarers],
    related: ["how-to-check-on-an-elderly-parent-who-lives-alone", "medication-reminder-for-elderly-parent", "caring-for-a-parent-from-a-distance"],
  },
  {
    slug: "caring-for-a-parent-from-a-distance",
    category: "caring",
    question: "How to care for an ageing parent from a distance",
    title: "Caring for a parent from a distance",
    description:
      "Build a local network, get the right permissions and contacts, keep information in one shared place, and use visits for what can't be done remotely.",
    answer:
      "Build a local network you can call on, get permission to deal with their GP surgery and pharmacy, keep their key information in one place you can reach, and save your visits for the things that can't be done from afar.",
    why:
      "Long-distance caring is mostly coordination: knowing what's going on, who to ring, and when something needs you to get on a train. The guilt of not being there makes people try to do everything by phone, which is exhausting and still leaves gaps. The practical blockers are usually access (the surgery won't talk to you), information (no one knows the latest medicines list) and timing (you find out about problems late).",
    steps: [
      {
        title: "Map who's local",
        body: "Neighbours, friends, a faith or community group, any paid carers. Get their numbers and agree who can pop round if needed.",
      },
      {
        title: "Sort access, with their agreement",
        body: "In England, GP surgeries can give a trusted person access to someone's online services, such as repeat prescriptions and appointments. The NHS calls this family and carer (proxy) access.",
      },
      {
        title: "Keep one shared record",
        body: "Medicines list, GP and pharmacy details, upcoming appointments, recent changes. Everyone helping should be able to see the same version.",
      },
      {
        title: "Ask about assessments",
        body: "A council needs assessment for your parent, and a carer's assessment for you, are both free. The NHS notes you count as a carer if you're regularly helping because someone is ill, older or disabled, including with appointments and medicines.",
      },
      {
        title: "Use technology they're comfortable with",
        body: "Alarms, a check-in call, or video calls, chosen with them.",
      },
      {
        title: "Plan visits around what needs you",
        body: "Appointments where you need to be present, assessments, sorting paperwork. Let local help cover the rest.",
      },
    ],
    avoid: [
      "Finding out about appointments after they've happened.",
      "Becoming the only point of contact for every professional.",
      "Making decisions for them. Unless they've lost capacity and you have legal authority, decisions are theirs.",
    ],
    nura:
      "Nura can be the regular check-in when you can't be there: with your parent's agreement, it calls them in their daytime and sends you a short summary of each call. The Care plan is a shared record you can invite a sibling or local friend to, and you can switch on an alert that tells the people you've invited when a scheduled check-in still isn't done a day later.",
    faqs: [
      {
        q: "Can I speak to my parent's GP?",
        a: "Only with your parent's consent. In England you can ask the surgery about family and carer (proxy) access to their online services.",
      },
      {
        q: "Am I a carer if I live far away?",
        a: "If you regularly help someone because they're ill, older or disabled, including organising appointments or medicines, the NHS says you're a carer, and you can ask your council for a carer's assessment.",
      },
    ],
    sources: [SRC.proxyAccess, SRC.carerAssessment, SRC.needsAssessment, SRC.alarms],
    related: ["how-to-share-the-care-of-a-parent-with-siblings", "daily-check-in-calls-for-elderly-parents", "how-to-check-on-an-elderly-parent-who-lives-alone"],
  },
  {
    slug: "how-to-share-the-care-of-a-parent-with-siblings",
    category: "caring",
    question: "How to share the care of a parent with your siblings",
    title: "Sharing a parent's care with siblings",
    description:
      "List every task, split them by what each person can actually do, keep one shared record of what's happening, and review the split before resentment builds.",
    answer:
      "List every task involved, not just the visible ones, split them by what each person can realistically do, keep one shared place where everyone can see what's happening, and agree to review the split regularly.",
    why:
      "Care usually falls to whoever lives nearest or noticed first, and it grows quietly: appointments, prescriptions, phone calls, worry. The person doing it often doesn't realise how much they've taken on until they're exhausted, and siblings further away often don't know what there is to help with. Most family tension about care comes from invisible work and information that only one person has.",
    steps: [
      {
        title: "Write down everything",
        body: "Appointments and transport, prescriptions, shopping, paperwork and bills, phone calls with professionals, visits, and the emotional support of just being in touch. The NHS lists these as the things carers do.",
      },
      {
        title: "Split by what's realistic",
        body: "Distance, work and family differ. The sibling who can't visit can still take the paperwork, the pharmacy calls or the weekly phone call.",
      },
      {
        title: "Keep one shared record",
        body: "Upcoming appointments, the current medicines list, what the doctor last said. If only one person knows, they become the bottleneck.",
      },
      {
        title: "Include your parent",
        body: "It's their care. Ask who they want involved and what they'd like to keep doing themselves.",
      },
      {
        title: "Review it",
        body: "A short check-in between siblings every month or two, before anyone gets to breaking point.",
      },
      {
        title: "Get support for the main carer",
        body: "A carer's assessment is free for anyone over 18 who cares for someone, and can lead to breaks and other help.",
      },
    ],
    avoid: [
      "Assuming whoever lives closest will do it.",
      "Updates by scattered phone calls, so everyone has a different version.",
      "Waiting until someone burns out to talk about it.",
    ],
    nura:
      "Invite your siblings to the Care plan about your parent and everyone sees the same thing: the plan's notes, its next steps and whether check-ins are done. Nura writes your circle a short update from that same information, in the app, by push notification or by email, and you can switch on an alert that tells them when a scheduled check-in still isn't done a day later. People you invite never see your private conversation with Nura.",
    faqs: [
      {
        q: "What if one sibling does most of the caring?",
        a: "Make the work visible by listing it, then ask others to take specific tasks rather than \"help where you can\". The main carer can also ask the council for a carer's assessment.",
      },
      {
        q: "How do we keep everyone updated without endless group chats?",
        a: "Keep one shared record of appointments, medicines and recent changes, and agree that updates go there.",
      },
    ],
    sources: [SRC.carerAssessment, SRC.respite],
    related: ["caring-for-a-parent-from-a-distance", "how-to-share-health-updates-with-family", "looking-after-yourself-as-a-carer"],
  },
  {
    slug: "how-to-share-health-updates-with-family",
    category: "caring",
    question: "How to keep family updated about your health (without retelling it every time)",
    title: "How to keep family updated on your health",
    description:
      "Decide who needs to know what, use one place for updates instead of retelling the story, and keep the parts that are private to you private.",
    answer:
      "Decide who you want to keep informed and how much they should know, then put updates in one place they can all see instead of retelling the story in a dozen calls, keeping anything private to yourself.",
    why:
      "When you're unwell or going through treatment, telling the same story over and over is tiring, and every retelling is slightly different. Family who aren't kept in the loop worry more and ask more. But you don't owe everyone everything: it's normal to want your partner to know the details and your aunt to know only that you're on the mend.",
    steps: [
      {
        title: "Decide your circle",
        body: "Who should know, and how much. You might have an inner circle and a wider group.",
      },
      {
        title: "Pick one channel",
        body: "One shared update rather than many conversations. People can read it when it suits them, and you only write it once.",
      },
      {
        title: "Stick to what helps them help you",
        body: "How you are, what's coming up, what you'd find useful (a lift to an appointment, a meal, a visit, or some space).",
      },
      {
        title: "Keep private things private",
        body: "Share the plan and progress; keep the rest for your clinicians and the people you choose.",
      },
      {
        title: "Name a point person",
        body: "Someone who can field questions from the wider group so you don't have to.",
      },
    ],
    avoid: [
      "Updating everyone individually until you're too tired to talk to anyone.",
      "Oversharing in a group chat you can't take back.",
      "Saying nothing, which usually leads to more worried phone calls, not fewer.",
    ],
    nura:
      "You can invite family, a friend or a carer to a specific Care plan. They see that plan's title, notes, next steps and check-in status, never your conversation with Nura, your documents, your phone number or your other Care plans. Nura writes them a short update from that plan, which you can always read yourself. If you want to pass on something specific, you type it on the plan or say yes when Nura asks at the end of a call, and they see exactly those words. You can remove anyone at any time.",
    faqs: [
      {
        q: "Do I have to tell my family about my health?",
        a: "No. It's your information, and you decide who knows what.",
      },
      {
        q: "Can I take back an update I shared?",
        a: "In Nura, yes: you can take back a message you passed on to your Care circle at any time, and remove people from a Care plan.",
      },
    ],
    sources: [SRC.proxyAccess],
    related: ["how-to-share-the-care-of-a-parent-with-siblings", "what-to-do-after-being-discharged-from-hospital", "how-to-remember-what-the-doctor-said"],
  },
  {
    slug: "looking-after-yourself-as-a-carer",
    category: "caring",
    question: "How to look after yourself when you're caring for someone",
    title: "Looking after yourself as a carer",
    description:
      "Recognise that you're a carer, ask your council for a carer's assessment, plan breaks before you need them, and share the load so it doesn't all fall on you.",
    answer:
      "Recognise that you're a carer, ask your local council for a free carer's assessment, plan regular breaks before you're exhausted, and share tasks with others so the whole load doesn't sit with you.",
    why:
      "Many carers don't think of themselves as carers; they're just a daughter, a husband or a friend helping out. That matters, because it means they don't ask for support they're entitled to. The NHS's definition is broad: if you regularly look after someone because they're ill, older or disabled, including helping with medicines, appointments or just keeping them company, you're a carer.",
    steps: [
      {
        title: "Call it what it is",
        body: "If you're regularly helping someone because of illness, age or disability, you're a carer. Tell your own GP too.",
      },
      {
        title: "Ask for a carer's assessment",
        body: "It's free, anyone over 18 can ask, and it's separate from any assessment for the person you care for. Contact adult social services at your local council. It might lead to breaks, practical help or contact with support groups.",
      },
      {
        title: "Plan breaks in advance",
        body: "The NHS describes respite options from a few hours of sitting service to day centres or a short stay in a care home. Councils fund respite only for people they've assessed, so get assessed early.",
      },
      {
        title: "Share specific tasks",
        body: "\"Could you do Tuesday's appointment?\" works better than \"let me know if you need anything\".",
      },
      {
        title: "Keep something for yourself",
        body: "Sleep, a walk, a friend. Small and regular beats a rare big break.",
      },
      {
        title: "Notice when it's too much",
        body: "Feeling worn down, irritable or hopeless for a long stretch is a sign to get support. Talk to your GP.",
      },
    ],
    avoid: [
      "Waiting for a crisis to ask for help.",
      "Turning down offers because it's quicker to do it yourself.",
      "Putting your own appointments last indefinitely.",
    ],
    nura:
      "Nura can take some of the remembering and checking off you: it can check in on the person you care for, with their agreement, and send you a summary, and it can keep track of their appointments and next steps in a Care plan you share with others. It can also check in on you; caring is health and wellbeing too.",
    faqs: [
      {
        q: "Who can get a carer's assessment?",
        a: "In England, anyone over 18 who cares for someone can ask their local council for one. It's free.",
      },
      {
        q: "What is respite care?",
        a: "Taking a break from caring while someone else looks after the person you care for, from a few hours to a short stay. Your council or local carers' centre can tell you what's available.",
      },
    ],
    sources: [SRC.carerAssessment, SRC.respite, SRC.stress],
    related: ["how-to-share-the-care-of-a-parent-with-siblings", "caring-for-a-parent-from-a-distance", "how-to-manage-stress-from-work"],
  },
  {
    slug: "checking-on-a-parent-after-a-hospital-stay",
    category: "caring",
    question: "How to support a parent after a hospital stay",
    title: "Supporting a parent after a hospital stay",
    description:
      "Be part of discharge planning if they want you there, check medicines and follow-ups, arrange support for the first days, and keep checking in as things settle.",
    answer:
      "Be involved in discharge planning if your parent wants you there, make sure the GP letter, medicines and follow-up appointments are sorted, arrange someone to stay or visit in the first days, and keep checking in as they recover.",
    why:
      "The days after discharge are when things can slip: a new medicine runs out, a follow-up isn't booked, or a parent who said they'd manage finds they can't. The NHS notes that with permission, family and carers can be kept informed and contribute to discharge planning, and that it may help for someone to stay or visit regularly. Your parent decides how involved you are.",
    steps: [
      {
        title: "Ask to be involved, with their agreement",
        body: "Hospital staff plan discharge with the patient, and family and carers can be part of those discussions if your parent wants.",
      },
      {
        title: "Check the basics on the day",
        body: "Transport home, house keys, food in, and any equipment they know how to use.",
      },
      {
        title: "Sort medicines quickly",
        body: "Hospital supplies usually last about 7 days. Make sure a repeat prescription is ordered in time, and that any changes are on their medicines list.",
      },
      {
        title: "Make sure the GP has the letter",
        body: "The NHS advises giving the discharge letter to the GP as soon as possible.",
      },
      {
        title: "Plan the first week",
        body: "Who visits or stays, who rings, and when. The NHS suggests a friend or relative stays or visits regularly if possible.",
      },
      {
        title: "Ask about extra help",
        body: "Short-term care after hospital may be offered after a needs assessment; if they need longer-term support, the council arranges a care needs assessment.",
      },
    ],
    avoid: [
      "Assuming \"they said they'd be fine\" means they will be.",
      "Leaving medicines to sort themselves out between hospital, GP and pharmacy.",
      "Visiting a lot in the first week and then stopping suddenly.",
    ],
    nura:
      "Nura can check in on your parent after they get home. With their agreement, it calls them in their daytime and sends you a short summary of each call, so you know how they're doing between your own calls and visits. The Care plan holds the follow-up dates and next steps, and siblings can be invited to see it too.",
    faqs: [
      {
        q: "Can family be involved in hospital discharge?",
        a: "Yes, with the patient's permission. The NHS says family and carers can be kept informed and given the chance to contribute.",
      },
      {
        q: "What if my parent can't manage at home after discharge?",
        a: "Talk to the hospital before discharge or contact the council's adult social services afterwards. Short-term care and needs assessments are available.",
      },
    ],
    sources: [SRC.discharge, SRC.planningToLeave, SRC.needsAssessment],
    related: ["what-to-do-after-being-discharged-from-hospital", "daily-check-in-calls-for-elderly-parents", "how-to-check-on-an-elderly-parent-who-lives-alone"],
  },
];
