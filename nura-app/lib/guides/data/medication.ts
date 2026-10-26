import { SRC } from "../sources";
import type { Guide } from "../types";

export const MEDICATION_GUIDES: Guide[] = [
  {
    slug: "how-to-remember-to-take-medication",
    category: "medication",
    question: "How to remember to take your medication",
    title: "How to remember to take your medication",
    description:
      "Tie each dose to something you already do, keep medicines where you'll see them, and use a reminder that checks back rather than one you can swipe away.",
    answer:
      "Tie each dose to something you already do every day, keep the medicine where that habit happens, and use a reminder that checks back with you rather than one you can swipe away without thinking.",
    why:
      "Forgetting a medicine is rarely about not caring. Most missed doses happen on days that aren't normal: a late shift, a weekend away, a morning that started in a rush. A phone alarm works for a week and then becomes background noise, because dismissing it takes less effort than getting up and taking the tablet. The other common problem is not remembering whether you took it at all, which is its own kind of worry. A good system answers two questions, not one: \"is it time?\" and \"did I actually take it?\"",
    steps: [
      {
        title: "Anchor the dose to a fixed habit",
        body: "Pick something you do every day without fail, such as brushing your teeth, the first cup of tea, or plugging your phone in at night, and take the medicine straight after it. Check the leaflet first: some medicines need to be taken at a particular time of day, or with or without food, and the anchor has to fit that.",
      },
      {
        title: "Put the medicine where the habit happens",
        body: "If the anchor is breakfast, the box lives next to the kettle (out of reach of children). Medicines in a drawer in another room are the ones that get missed.",
      },
      {
        title: "Make \"did I take it?\" answerable",
        body: "A pill organiser with days of the week, or ticking a simple chart, means you can check in a second. If you take several medicines at different times, ask your pharmacist whether a compartment box or other reminder would suit them; the NHS notes these are not right for every medicine.",
      },
      {
        title: "Use a reminder that expects a reply",
        body: "An alarm you dismiss teaches you to dismiss it. A reminder that asks \"have you taken it?\" and waits for a yes keeps the step honest, and gives you a record of the days it slipped.",
      },
      {
        title: "Plan for the unusual days",
        body: "Holidays, night shifts and hospital appointments are where routines break. Decide in advance where the medicine will be and when you'll take it on those days.",
      },
      {
        title: "Keep the supply going",
        body: "Running out is a common reason for gaps. The NHS suggests ordering a repeat prescription up to 5 working days before you need it.",
      },
    ],
    avoid: [
      "Relying on memory alone \"because it's only one tablet\". Simple routines are exactly the ones that slip on an unusual day.",
      "Setting five alarms. More alerts usually means more dismissing, not more taking.",
      "Taking an extra dose to make up for one you think you missed. The NHS warns that taking a double dose to make up for a missed one can be dangerous; check the leaflet or ask a pharmacist.",
    ],
    nura:
      "Tell Nura something like \"remind me every morning to take my tablets\" and it sets up a repeating check-in, daily, on weekdays or weekly, by phone call, WhatsApp or in the app. It asks whether you've taken it rather than just announcing the time, and it notes a missed dose so it's there next time. If a dose was missed, it points you to the leaflet or your pharmacist instead of telling you what to do, because that's their call.",
    faqs: [
      {
        q: "What should I do if I forget a dose?",
        a: "Follow the instructions in the leaflet that came with the medicine, or ask a pharmacist. What to do depends on the medicine, and the NHS warns against taking a double dose to make up for a missed one.",
      },
      {
        q: "Is a phone alarm enough?",
        a: "For some people, yes. If you find yourself dismissing it without taking the medicine, switch to something that asks for a reply, or tie the dose to a habit so the alarm is a back-up rather than the whole plan.",
      },
    ],
    sources: [SRC.medicinesForCarers, SRC.medicinesAZ, SRC.repeatPrescription, SRC.pharmacies],
    related: ["missed-a-dose-of-medication-what-to-do", "how-to-keep-a-list-of-your-medications", "medication-reminder-for-elderly-parent"],
  },
  {
    slug: "medication-reminder-for-elderly-parent",
    category: "medication",
    question: "Medication reminders for an elderly parent: what actually works",
    title: "Medication reminders for an elderly parent",
    description:
      "How to help an older parent remember their medicines without taking over: pill organisers, pharmacist reviews, reminder calls and respecting their say.",
    answer:
      "Start with a pharmacist review of everything they take, set up a simple organiser if it suits their medicines, and add a reminder that checks in with them directly, so you know a dose was taken without having to ring every day yourself.",
    why:
      "When a parent starts missing medicines, the instinct is to take over. That often backfires: it can feel like losing independence, and it puts the whole job on one adult child. The NHS also points out that the person you care for has a right to confidentiality and decides how much of their health and medicines information you see. The aim is support they agree to, not surveillance. Older people are also more likely to take several medicines at different times of day, which makes a single alarm a poor fit.",
    steps: [
      {
        title: "Ask them what's going wrong",
        body: "Forgetting, confusion about which tablet is which, side effects, difficulty opening packs, and running out all look the same from the outside and need different fixes. Ask before you buy anything.",
      },
      {
        title: "Ask for a medication review",
        body: "If they take several medicines, their GP surgery may offer a free structured medication review with a pharmacist. The NHS suggests going along with them if you're helping, so you both hear the same thing.",
      },
      {
        title: "Talk to the pharmacist about a compartment box",
        body: "For a complicated routine, a pharmacist may provide medicines in a compartment (dosette) box that shows what to take when. The NHS notes these aren't always free and don't suit every medicine, so ask rather than refilling one yourself.",
      },
      {
        title: "Keep medicines in one place",
        body: "One cupboard, one routine. The NHS recommends keeping medicines together, ideally locked away if children visit.",
      },
      {
        title: "Add a check-in that reaches them, not you",
        body: "The NHS lists phoning them when a medicine is due as one way to help. A reminder call or message to them, with the result passed to you, gives the same reassurance without you being on the phone every morning.",
      },
      {
        title: "Sort repeat prescriptions",
        body: "Ask the GP surgery whether prescriptions can go straight to a pharmacy, and whether that pharmacy delivers. Running out is one of the easiest gaps to close.",
      },
    ],
    avoid: [
      "Setting it all up without asking them. A system they didn't agree to is a system they'll ignore.",
      "Refilling a pill box yourself from the original packs without checking with a pharmacist that the medicines are suitable for it.",
      "Making yourself the only reminder. It works until the day you're on a train or ill yourself.",
    ],
    nura:
      "Nura can check in on someone you care for. You create a Care plan about your parent and add their first name and number; Nura only calls them after they agree, by tapping Yes on a link you send or by you confirming they're happy to be called. The calls happen in their daytime, you get a short summary of each one, and nothing you've told Nura privately is read out to them. They can say \"stop\" on any call and the calls end.",
    faqs: [
      {
        q: "Can I see my parent's prescriptions online?",
        a: "In England, GP surgeries can give a trusted person access to someone else's online services, such as repeat prescriptions, with that person's agreement. The NHS calls this family and carer (proxy) access; ask their GP surgery.",
      },
      {
        q: "What if they refuse help with their medicines?",
        a: "It's their decision. Ask what would feel acceptable, such as a reminder that comes to them rather than you checking, and raise any worries with their GP or pharmacist.",
      },
    ],
    sources: [SRC.medicinesForCarers, SRC.proxyAccess, SRC.pharmacies],
    related: ["daily-check-in-calls-for-elderly-parents", "how-to-remember-to-take-medication", "how-to-check-on-an-elderly-parent-who-lives-alone"],
  },
  {
    slug: "missed-a-dose-of-medication-what-to-do",
    category: "medication",
    question: "Missed a dose of your medication? What to do next",
    title: "Missed a dose of medication: what to do",
    description:
      "Don't double up. Check the leaflet or ask a pharmacist, note what happened, and fix the reason it was missed so it doesn't happen again.",
    answer:
      "Don't take a double dose to make up for it. Check the patient information leaflet that came with the medicine, or ask a pharmacist, because the right step depends on the medicine; then make a note of the missed dose so your next check is accurate.",
    why:
      "There is no single rule for missed doses, which is why searching for one is so confusing. For some medicines you take it as soon as you remember; for others you skip it and carry on; for some, timing really matters and you should get advice. The NHS's medicine pages give the answer for each medicine individually, and the leaflet in the box does too. What is true across the board is the NHS warning that taking a double dose later to make up for a missed one can be dangerous.",
    steps: [
      {
        title: "Don't double up",
        body: "Whatever else you do, don't take two doses together to catch up unless a pharmacist or prescriber has told you to.",
      },
      {
        title: "Read the leaflet",
        body: "The patient information leaflet in the box has a section on what to do if you forget a dose. The NHS medicines A to Z has the same kind of guidance for common medicines.",
      },
      {
        title: "Ask a pharmacist if you're unsure",
        body: "Pharmacists can advise on how to use your medicine, including missed doses, and you don't need an appointment for advice. If it's out of hours and you need help now, NHS 111 can advise in the UK.",
      },
      {
        title: "Write down what happened",
        body: "Note the medicine, the dose you missed and roughly when. If it happens again, that note is what lets your GP or pharmacist see a pattern.",
      },
      {
        title: "Fix the cause",
        body: "Was it a broken routine, running out, side effects you were avoiding, or not being sure whether you'd taken it? Each has a different fix, and side effects are worth raising with whoever prescribed it.",
      },
    ],
    avoid: [
      "Guessing based on what you did with a different medicine. The advice genuinely varies.",
      "Stopping a medicine because you've missed a few doses and feel fine. Talk to your prescriber or pharmacist before stopping anything.",
      "Hiding repeated missed doses from your GP. They need to know whether the medicine is being taken to judge whether it's working.",
    ],
    nura:
      "If you tell Nura you missed a dose, it notes it so it's reflected next time and points you to the leaflet or your pharmacist. It never tells you to double up or change a dose. If missed doses keep happening, or you mention new or worsening side effects, it encourages you to contact your pharmacist or clinician, and it can set up a daily check-in to make the next one less likely.",
    faqs: [
      {
        q: "Should I take it as soon as I remember?",
        a: "Sometimes, but not always. It depends on the medicine and how close you are to the next dose. The leaflet or a pharmacist will tell you which applies.",
      },
      {
        q: "When is a missed dose urgent?",
        a: "If you've taken too much, or you feel unwell after a missed or extra dose, get help: call NHS 111 in the UK, or 999 (911 in the US) in an emergency.",
      },
    ],
    sources: [SRC.medicinesForCarers, SRC.medicinesAZ, SRC.pharmacies, SRC.nhs111],
    related: ["how-to-remember-to-take-medication", "questions-to-ask-about-a-new-medicine", "how-to-keep-a-list-of-your-medications"],
  },
  {
    slug: "how-to-keep-a-list-of-your-medications",
    category: "medication",
    question: "How to keep an up-to-date list of your medications",
    title: "How to keep a list of your medications",
    description:
      "What to put on a medicines list (including vitamins and supplements), where to keep it, and how to keep it current so it helps at every appointment.",
    answer:
      "Write down every medicine you take, including vitamins, supplements and anything bought over the counter, with the strength, how you take it and why, and keep it somewhere you'll have it at every appointment.",
    why:
      "The NHS advises bringing a list of all your medicines, including vitamins and supplements, to appointments. It sounds simple, but lists go out of date the first time a dose changes, and the most useful details, such as why a medicine was started or what was stopped and why, are the ones people forget. A list that only lives on paper in a kitchen drawer doesn't help in an unplanned hospital visit.",
    steps: [
      {
        title: "List everything",
        body: "Prescribed medicines, inhalers, creams, eye drops, injections, vitamins, supplements and over-the-counter medicines. The NHS notes that over-the-counter medicines shouldn't be taken with prescribed ones unless a doctor or pharmacist has confirmed it's safe, which is why they belong on the list.",
      },
      {
        title: "Copy the details from the label",
        body: "Name, strength and how you take it, exactly as the pharmacy label says. Don't work it out from memory.",
      },
      {
        title: "Add the why and the when",
        body: "What it's for, who started it and roughly when. Add anything stopped recently and the reason, such as a side effect.",
      },
      {
        title: "Note allergies and reactions",
        body: "Anything you've reacted to before goes at the top.",
      },
      {
        title: "Keep it where you'll have it",
        body: "On your phone as well as on paper. If someone helps you with your care, make sure they know where it is.",
      },
      {
        title: "Update it the same day",
        body: "Every time something changes after an appointment or hospital stay, update the list before you put the new box away.",
      },
    ],
    avoid: [
      "Bringing a bag of boxes instead of a list. It helps, but it misses anything at home and anything stopped.",
      "Leaving out supplements because they're \"natural\".",
      "Treating the list as medical advice. It's a record; any change to what you take is for your prescriber or pharmacist.",
    ],
    nura:
      "You can send Nura a photo of a pharmacy label, a clinic letter or your discharge paperwork, or just tell it what you take, and it keeps that context in your Care plan so it's in one place. Before your next appointment, the plan's summary pulls together what you've reported and suggests questions you may want to raise. Nura records what you tell it; it doesn't check doses or interactions.",
    faqs: [
      {
        q: "Does my GP already have my medicines list?",
        a: "Your GP record holds what was prescribed through the practice, but it may not include things bought over the counter, supplements, or recent hospital changes. Your own list fills those gaps.",
      },
      {
        q: "Who can check my list for problems?",
        a: "A pharmacist. If you take several medicines, your GP surgery may offer a structured medication review.",
      },
    ],
    sources: [SRC.whatToAsk, SRC.medicinesForCarers, SRC.pharmacies],
    related: ["how-to-prepare-for-a-gp-appointment", "questions-to-ask-about-a-new-medicine", "what-to-do-after-being-discharged-from-hospital"],
  },
  {
    slug: "questions-to-ask-about-a-new-medicine",
    category: "medication",
    question: "Questions to ask when you're prescribed a new medicine",
    title: "Questions to ask about a new medicine",
    description:
      "What to ask your prescriber or pharmacist about a new medicine: how to take it, side effects, how you'll know it's working, and who to call.",
    answer:
      "Ask what it's for, how and when to take it, what side effects to watch for, how you'll know it's working, how long you'll take it, and who to contact if something doesn't feel right.",
    why:
      "A new prescription usually arrives at the end of an appointment, when you're already thinking about getting home. Questions come later, at the kitchen table, when the only source to hand is the leaflet. In England, a pharmacist may be able to give extra help when you start some new medicines, with up to 3 appointments, but many people don't know to ask.",
    steps: [
      {
        title: "What is it for, and what should I expect?",
        body: "The NHS suggests asking how you'll know if the treatment is working and how long you'll need it.",
      },
      {
        title: "How exactly do I take it?",
        body: "Time of day, with or without food, and anything to avoid. The NHS notes that taking a medicine at the wrong time or the wrong way round meals can stop it working properly or cause side effects.",
      },
      {
        title: "What side effects should I look out for?",
        body: "And which ones mean you should get in touch rather than wait.",
      },
      {
        title: "Does it mix with what I already take?",
        body: "Bring your full list, including supplements and over-the-counter medicines, so the pharmacist or prescriber can check.",
      },
      {
        title: "What if I miss a dose?",
        body: "Get the answer for this medicine now, so you're not searching for it later.",
      },
      {
        title: "Who do I contact with problems?",
        body: "The NHS suggests asking who to contact if you have more problems or questions, and what happens next.",
      },
    ],
    avoid: [
      "Relying on remembering the answers. Write them down, or bring someone to take notes.",
      "Stopping a new medicine because of a side effect without talking to the pharmacist or prescriber first.",
      "Assuming the pharmacist is only there to hand it over. Advice on how to use a medicine and on side effects is part of what they do.",
    ],
    nura:
      "Nura can hold the answers once you have them: tell it what the prescriber said, or send a photo of the letter or label, and it becomes part of your Care plan. You can ask it to check in on how you're getting on with the new medicine. If you mention new or worsening side effects, it encourages you to contact your pharmacist or clinician; it won't tell you to change or stop anything.",
    faqs: [
      {
        q: "Can I ask the pharmacist instead of going back to my GP?",
        a: "For questions about how to use a medicine and its side effects, yes; pharmacists give that advice and can refer you on if needed.",
      },
      {
        q: "What is the NHS help with new medicines?",
        a: "When you start some new medicines in England, a pharmacist may offer up to 3 appointments, in person or by phone, to answer questions and help you use the medicine safely.",
      },
    ],
    sources: [SRC.whatToAsk, SRC.pharmacies, SRC.medicinesForCarers],
    related: ["missed-a-dose-of-medication-what-to-do", "how-to-keep-a-list-of-your-medications", "questions-to-ask-your-doctor"],
  },
];
