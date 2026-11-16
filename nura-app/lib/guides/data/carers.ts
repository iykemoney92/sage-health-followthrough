import { SRC } from "../sources";
import type { Guide } from "../types";
import { CARE_FOR_TEASER, CHECK_IN_TEASER, IMG, TRY_LINK, media } from "./media";

/** For people who look after someone: assessments, breaks and their own wellbeing. */
export const CARER_GUIDES: Guide[] = [
  {
    slug: "caregiver-burnout-signs",
    category: "caring",
    question: "Caregiver burnout: the signs, and what helps",
    title: "Caregiver burnout: signs and what helps",
    description:
      "How carer exhaustion usually shows up, why it creeps up, and the practical things that ease it: breaks, a carer's assessment, sharing the load.",
    answer:
      "Caregiver burnout is the physical and emotional exhaustion that builds when you've been looking after someone for a long time without enough rest or help. Common signs are constant tiredness, poor sleep, irritability, feeling low or numb, dropping your own friends and interests, and getting ill more often. What helps is real breaks (respite), sharing the caring, a free carer's assessment, and getting support for your own mood and sleep.",
    why:
      "Caring rarely starts as a decision. It grows from a lift to the shops into daily help, and because it happens gradually, many people don't think of themselves as carers or notice how much they've taken on. There's guilt about wanting a break, worry that nobody else will do it right, and no natural end point. The NHS describes respite as a way to stop carers becoming exhausted and run down, which tells you how common that is.",
    sections: [
      {
        heading: "What are the signs of caregiver burnout?",
        paras: ["Everyone's different, but carers describe:"],
        list: [
          "Feeling tired all the time, even after sleep, or not sleeping well.",
          "Being short-tempered with the person you care for, then feeling guilty.",
          "Feeling low, hopeless, numb or tearful.",
          "Giving up friends, exercise, hobbies or work you used to enjoy.",
          "Getting ill more often, or putting off your own health appointments.",
          "Dreading the next day, or feeling trapped.",
        ],
      },
      {
        heading: "When should you get help for yourself?",
        paras: [
          "The NHS suggests seeing a GP if you're struggling to cope with stress, anxiety or low mood, have had a low mood for more than 2 weeks, or things you're trying aren't helping. In the UK you can also refer yourself to NHS talking therapies. If you ever feel you might harm yourself or the person you care for, get help straight away: call 999, or NHS 111 in the UK.",
        ],
      },
    ],
    steps: [
      {
        title: "Call it what it is",
        body: "Recognising you're a carer, and that you're running on empty, is the first step to getting help. The NHS counts emotional support and watching over someone as caring, not just physical help.",
      },
      {
        title: "Ask for a carer's assessment",
        body: "It's free for anyone over 18. It can recommend things like someone taking over so you can take a break, help with housework, or putting you in touch with support groups.",
      },
      {
        title: "Plan regular breaks",
        body: "Respite can be a few hours of a sitting service, a day centre, homecare, or a short stay in a care home. Book it before you're desperate.",
      },
      {
        title: "Share the caring out",
        body: "Write down what you do in a week and ask family or friends to take specific pieces, not \"let me know if you need anything.\"",
      },
      {
        title: "Protect one thing for you",
        body: "A walk, a class, an hour with a friend. Put it in the diary like an appointment.",
      },
      {
        title: "Look after your sleep and mood",
        body: "Talk to your GP if it's getting on top of you. Your health matters to the person you care for too.",
      },
    ],
    avoid: [
      "Waiting until you're at breaking point to ask for a break.",
      "Saying yes to every task because it's quicker to do it yourself.",
      "Skipping your own health appointments.",
    ],
    nura:
      "Nura can lighten two parts of it. For the person you look after, with their agreement, Nura gives them a short call in their daytime and tells you how it went, so you don't have to be the one ringing every day. For you, Nura can check in on your own sleep, stress and energy at a time you choose, and help you pick one small step on a hard week. If you mention thoughts of self-harm or that someone is in danger, it tells you to contact emergency or crisis services straight away.",
    faqs: [
      {
        q: "Is caregiver burnout the same as depression?",
        a: "Not necessarily, but long-term exhaustion and low mood can overlap with it. If you've felt low for more than 2 weeks, the NHS suggests seeing a GP.",
      },
      {
        q: "Can I get a break from caring?",
        a: "Yes. Ask the council for a carer's assessment and a needs assessment for the person you care for; councils only fund respite for people they've assessed as needing it. Charities also run sitting services.",
      },
    ],
    sources: [SRC.carerAssessment, SRC.respite, SRC.lonely, SRC.stress],
    related: [
      "looking-after-yourself-as-a-carer",
      "what-is-respite-care",
      "what-is-a-carers-assessment",
      "how-to-share-the-care-of-a-parent-with-siblings",
    ],
    media: media(
      IMG.goals,
      "Nura asks what you want help with first. Carers often pick stress or emotional wellbeing as well as looking out for someone.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "what-is-respite-care",
    category: "caring",
    question: "What is respite care, and how do you arrange it?",
    title: "What is respite care? A guide for carers",
    description:
      "The types of respite care, from sitting services to short care-home stays, who pays, and how to plan an emergency back-up before you need it.",
    answer:
      "Respite care means taking a break from caring while the person you look after is cared for by someone else. It can be a volunteer sitting with them for a few hours, a day centre, a paid carer at home, family stepping in, a respite holiday, or a short stay in a care home. Councils fund it only after a needs assessment and a carer's assessment; otherwise charities may help, or you pay yourself.",
    why:
      "Many carers only think about respite when they're already exhausted, and then find short-notice places hard to get. The NHS says it can be difficult to get respite space at short notice but some care homes take advance bookings. Guilt also stops people: a break can feel like abandoning the person you care for, when it's actually what keeps the caring going.",
    sections: [
      {
        heading: "What are the types of respite care?",
        paras: ["The NHS lists the main types as:"],
        list: [
          "Day care centres, which offer company and activities, often with transport.",
          "Homecare from a paid carer, regularly (say one day a week) or for a short period such as a holiday.",
          "A short stay in a care home.",
          "Friends and family helping, either moving in for a while or having the person to stay.",
          "Respite holidays.",
          "Sitting services, where a trained volunteer keeps the person company for a few hours, often free or for a small charge.",
        ],
      },
      {
        heading: "Who pays for respite care?",
        paras: [
          "Councils only pay for respite for people they've assessed as needing it, after a needs assessment and a carer's assessment, followed by a financial assessment. You can then ask the council to arrange it or do it yourself through a personal budget or direct payment. Some charities offer grants, and some services, such as sitting services, may be free.",
        ],
      },
      {
        heading: "Plan for an emergency, too",
        paras: [
          "The NHS suggests thinking about who could step in if you suddenly couldn't be there, making sure they have keys or a key safe code, and leaving written notes about the care needed, including essential information about medicines and any dos and don'ts.",
        ],
      },
    ],
    steps: [
      {
        title: "Get both assessments",
        body: "A needs assessment for the person you care for and a carer's assessment for you. Even without council funding, the NHS says a needs assessment shows which kind of respite suits best.",
      },
      {
        title: "Choose the kind of break",
        body: "A regular few hours a week, a day centre, or a longer break for a holiday. Many carers need both.",
      },
      {
        title: "Book ahead",
        body: "Short-notice places are hard to find. Some care homes take advance bookings.",
      },
      {
        title: "Write a care note",
        body: "Routines, likes and dislikes, medicines, who to call. It makes handing over far less stressful.",
      },
      {
        title: "Name an emergency back-up",
        body: "Someone with a key who knows the basics and can step in for a few hours.",
      },
    ],
    avoid: [
      "Waiting until you're at breaking point.",
      "Assuming respite only means a care home.",
      "Keeping the care routine only in your head.",
    ],
    nura:
      "Nura can help keep things steady while you're away. A Care plan holds the notes and next steps, and you can invite whoever is stepping in so they see the same plan (never your private conversation with Nura). With the person's agreement, Nura can keep giving them a short call in their daytime and send the summary to you, so you can rest knowing someone has checked in.",
    faqs: [
      {
        q: "How long can respite care last?",
        a: "Anything from a few hours (a sitting service) to a short stay of days or weeks in a care home, depending on what's arranged.",
      },
      {
        q: "Is respite care free?",
        a: "Sometimes. Councils may pay after assessments and a means test, some charity services are free or low cost, and otherwise you pay.",
      },
    ],
    sources: [SRC.respite, SRC.carerAssessment, SRC.needsAssessment, SRC.meansTest],
    related: [
      "caregiver-burnout-signs",
      "what-is-a-carers-assessment",
      "looking-after-yourself-as-a-carer",
      "how-to-get-help-at-home-for-an-elderly-parent",
    ],
    media: media(
      IMG.tryMum,
      "A real plan from Nura's try-it box: checking in on a mum who lives alone, written from one sentence.",
      TRY_LINK,
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "what-is-a-carers-assessment",
    category: "caring",
    question: "What is a carer's assessment, and how do you prepare?",
    title: "What is a carer's assessment?",
    description:
      "What a carer's assessment covers, what it can lead to, what to bring, and how to make sure it reflects what caring is really like for you.",
    answer:
      "A carer's assessment is a free conversation with your local council (or an organisation it works with) about how caring affects you: your physical and mental health, work, free time and relationships. Anyone over 18 who cares for someone can ask for one. It can lead to support such as breaks, help with housework, transport costs or support groups, and if you qualify the council writes a care and support plan with you.",
    why:
      "Many carers never ask, because they don't see themselves as carers or think the help is only for the person they look after. Others go in, say \"I'm fine, I manage\", and come away with nothing. The assessment is about you, and it only works if you describe honestly what a normal week is like.",
    sections: [
      {
        heading: "What can a carer's assessment recommend?",
        paras: ["The NHS gives examples such as:"],
        list: [
          "Someone to take over caring so you can take a break.",
          "Gym membership or exercise classes to relieve stress.",
          "Help with taxi fares if you don't drive.",
          "Help with gardening and housework.",
          "Training in how to lift safely.",
          "Putting you in touch with local support groups.",
          "Advice about benefits for carers.",
        ],
      },
      {
        heading: "What happens at the assessment?",
        paras: [
          "Someone asks how you're coping with caring, including your health, work, free time and relationships. It's usually face to face, though some councils do it by phone or online, and the NHS says it usually lasts at least an hour. You can have the person you care for, a friend or relative with you, or an advocate.",
          "The NHS suggests having ready your NHS number, your GP's details, contact details for anyone coming with you, and the name, address, date of birth and NHS number of the person you care for if you have them.",
        ],
      },
    ],
    steps: [
      {
        title: "Ask for it",
        body: "Contact adult social services at your local council (for a child, the children with disabilities department). You can call or apply online.",
      },
      {
        title: "Ask for both assessments together",
        body: "If the person you care for hasn't had a needs assessment, you can ask for both at the same time.",
      },
      {
        title: "Keep a week's diary first",
        body: "Write down everything you do, including nights, emotional support, paperwork and travel. The NHS says to give as much detail as you can about the impact on your life.",
      },
      {
        title: "Say what you'd want",
        body: "A regular break, help with a specific task, time to work or study. Be concrete.",
      },
      {
        title: "Follow up the result",
        body: "If you qualify, you'll get a care and support plan. If not, the council should still give free advice about help in your community. You can complain if you disagree.",
      },
    ],
    avoid: [
      "Playing it down because you feel you should cope.",
      "Only describing the physical tasks and leaving out the worry, broken sleep and lost time.",
      "Assuming you don't count as a carer because you're family.",
    ],
    nura:
      "A short log makes an assessment much easier, and Nura can help you keep one. You can tell Nura how things went in a sentence or a voice note, and it keeps your notes in a Care plan. If the person you care for agrees, Nura can also give them a short call in their daytime and send you a summary of each call, which shows how things have actually been going between visits.",
    faqs: [
      {
        q: "Who can have a carer's assessment?",
        a: "Anyone over 18 who cares for someone. The NHS says you're a carer if you regularly look after someone because they're ill, older or disabled, including family members.",
      },
      {
        q: "Does a carer's assessment affect the person I care for?",
        a: "It's separate from their needs assessment, though you can have them at the same time.",
      },
      {
        q: "Is a carer's assessment free?",
        a: "Yes. Any support it leads to may involve a financial assessment.",
      },
    ],
    sources: [SRC.carerAssessment, SRC.needsAssessment, SRC.careSupportPlans, SRC.advocate],
    related: [
      "am-i-a-carer",
      "what-is-a-care-and-support-plan",
      "what-is-respite-care",
      "caregiver-burnout-signs",
    ],
    media: media(
      IMG.describe,
      "You can tell Nura what's going on in your own words, or a voice note, and it keeps it in one place.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "am-i-a-carer",
    category: "caring",
    question: "Am I a carer? What counts as caring for someone",
    title: "Am I a carer? What counts as caring",
    description:
      "Many people who help a parent, partner or friend don't realise they're a carer. What counts, why it matters, and the support it opens up.",
    answer:
      "You're a carer if you regularly look after someone because they're ill, older or disabled, and that includes family. It isn't only washing and dressing: the NHS counts help with medicines, getting to appointments, shopping, cleaning, bills and finances, and emotional support such as keeping someone company or watching over them. Recognising it matters, because it opens up a free carer's assessment and other support.",
    why:
      "Most people think of themselves as a daughter, son, partner or friend, not a carer, so they don't look for help that's meant for them. Caring often grows slowly from a few favours into a big part of every week. By the time people realise, they're often exhausted.",
    sections: [
      {
        heading: "What counts as caring?",
        paras: ["The NHS says carers help with things like:"],
        list: [
          "Washing, dressing or taking medicines.",
          "Getting out and about, and travelling to appointments.",
          "Shopping, cleaning and laundry.",
          "Paying bills and organising finances.",
          "Emotional support: sitting with someone to keep them company, or watching over someone who can't be left alone.",
        ],
      },
      {
        heading: "What support is there for carers?",
        paras: [
          "In England, the starting point is a free carer's assessment from your local council, which can lead to things like breaks, practical help and support groups, and a care and support plan if you qualify. The NHS also covers carers' breaks and respite, and benefits for carers. If you work, it's worth telling your employer, as many have carer policies.",
        ],
      },
    ],
    steps: [
      {
        title: "Write down what you do",
        body: "Everything for a week, including phone calls, worry, paperwork and lifts. It's usually more than you think.",
      },
      {
        title: "Tell people",
        body: "Your GP practice (so they know you're a carer), your employer, and close friends.",
      },
      {
        title: "Ask for a carer's assessment",
        body: "Contact adult social services at your local council. It's free for anyone over 18.",
      },
      {
        title: "Find local support",
        body: "Carers' centres and charities run groups and helplines. The NHS lists free helplines from Carers UK, Age UK and Independent Age.",
      },
      {
        title: "Plan one break",
        body: "Even a few hours a week through a sitting service or a relative makes a difference.",
      },
    ],
    avoid: [
      "Thinking it doesn't count because it's your mum or your partner.",
      "Thinking it doesn't count because you live elsewhere. Organising care, managing money and regular check-ins are caring too.",
      "Waiting until you're exhausted to look for support.",
    ],
    nura:
      "Nura is built for people looking out for someone as well as themselves. You can start a Care plan about the person you help; with their agreement, Nura gives them a short call in their daytime and tells you how it went, and you can invite family to see the same plan. Nura can also check in on you: caring is health and wellbeing too.",
    faqs: [
      {
        q: "Do I have to live with someone to be their carer?",
        a: "No. Helping someone regularly from a distance, with things like finances, appointments or emotional support, can still make you a carer.",
      },
      {
        q: "Do I have to be paid to be a carer?",
        a: "No. Most carers are unpaid family members or friends.",
      },
    ],
    sources: [SRC.carerAssessment, SRC.carersHub, SRC.respite],
    related: [
      "what-is-a-carers-assessment",
      "caregiver-burnout-signs",
      "looking-after-yourself-as-a-carer",
      "caring-for-a-parent-from-a-distance",
    ],
    media: media(
      IMG.goals,
      "\"Looking out for someone I care for\" is one of the first options in Nura, alongside sleep, stress and habits.",
    ),
    teaser: CHECK_IN_TEASER,
  },
];
