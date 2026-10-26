import { SRC } from "../sources";
import type { Guide } from "../types";

export const APPOINTMENT_GUIDES: Guide[] = [
  {
    slug: "questions-to-ask-your-doctor",
    category: "appointments",
    question: "Questions to ask your doctor at your appointment",
    title: "Questions to ask your doctor",
    description:
      "A short list of questions worth asking at a GP or hospital appointment, about tests, treatment and what happens next, and how to remember the answers.",
    answer:
      "Ask what any tests are for and how you'll get the results, what the treatment options are and how you'll know it's working, what happens next, and who to contact if things get worse.",
    why:
      "Appointments are short and the important question usually surfaces on the way home. The NHS's own advice is to write down your 2 or 3 most important questions beforehand, because a long list rarely gets finished. The questions that matter most are often not about the diagnosis at all but about what happens next: when results come, who to chase, and what to do if things change before then.",
    steps: [
      {
        title: "About tests",
        body: "What are the tests for? How and when will I get the results? Who do I contact if I don't hear?",
      },
      {
        title: "About treatment",
        body: "What do you recommend, and are there other options? Are there side effects or risks? How long will I need it, and how will I know it's working? Is there anything I should stop or avoid, and anything I can do to help myself?",
      },
      {
        title: "About what happens next",
        body: "Do I need to come back, and when? Who do I contact if things get worse? Is there written information or a support group?",
      },
      {
        title: "Before you leave",
        body: "Check you covered your list, repeat back what you understood (\"Can I just check I understood...\"), and write down what should happen next and when.",
      },
      {
        title: "Ask for copies of letters",
        body: "The NHS notes you're entitled to see letters written about you. They're the most reliable record of what was decided.",
      },
    ],
    avoid: [
      "Bringing fifteen questions and getting through three. Put the two or three that matter most at the top.",
      "Nodding along to words you don't understand. It's fine to ask for them to be written down and explained.",
      "Trusting yourself to remember. The NHS suggests writing things down or asking a friend or family member to take notes.",
    ],
    nura:
      "Nura keeps track of what you report between appointments and, from your Care plan, puts together a summary with patterns you've mentioned and questions you may want to discuss, which you can export and take with you. After the visit, tell Nura what was said, or send a photo of the letter, and it turns the next steps into check-ins so they don't get lost.",
    faqs: [
      {
        q: "Can I bring someone to my appointment?",
        a: "Yes. The NHS suggests taking a friend or family member for support and to help take notes.",
      },
      {
        q: "What if I forget to ask something?",
        a: "Contact the practice or clinic afterwards; ask during the appointment who you should contact with further questions so you know where to go.",
      },
    ],
    sources: [SRC.whatToAsk],
    related: ["how-to-prepare-for-a-gp-appointment", "how-to-remember-what-the-doctor-said", "how-to-follow-up-on-test-results"],
  },
  {
    slug: "how-to-prepare-for-a-gp-appointment",
    category: "appointments",
    question: "How to prepare for a GP appointment",
    title: "How to prepare for a GP appointment",
    description:
      "Write down your symptoms and top questions, bring your medicines list and someone to take notes, and know what you want to leave with.",
    answer:
      "Write down your symptoms (when they started and what makes them better or worse), your 2 or 3 most important questions and a list of everything you take, and decide what you want to leave the appointment knowing.",
    why:
      "Most of the work of a good appointment happens before you arrive. Symptoms that were obvious all week fade the moment you sit down, and the thing that worried you at 3am feels too small to mention. The NHS advice is practical: write it down, bring your medicines, and bring someone if you'd like. The harder part is noticing and recording things in the days before, when life is busy.",
    steps: [
      {
        title: "Describe your symptoms on paper",
        body: "When it started, how often it happens, what makes it better or worse, and what you've tried. Specific beats general: \"woke up twice a night with it, three nights this week\" tells the GP more than \"it's been bad\".",
      },
      {
        title: "Pick your top questions",
        body: "Write down your 2 or 3 most important questions and put them first.",
      },
      {
        title: "List your medicines",
        body: "Everything you take, including vitamins and supplements.",
      },
      {
        title: "Ask for support if you need it",
        body: "Ask the surgery for an interpreter or communication support, or bring a friend or family member.",
      },
      {
        title: "Know what you want to leave with",
        body: "A plan, a referral, a test, reassurance, or just to understand what's going on. Saying it early helps the GP use the time well.",
      },
      {
        title: "Book any follow-ups before you forget",
        body: "The NHS suggests booking any tests you can and putting the dates in your diary straight away.",
      },
    ],
    avoid: [
      "Trying to remember a week of symptoms on the spot.",
      "Leaving the main worry until the end of the appointment.",
      "Underplaying things to seem less of a bother. Accurate is more useful than brave.",
    ],
    nura:
      "In the days before an appointment you can tell Nura how you're doing in a message, a voice note or a WhatsApp, and it keeps those updates together in a Care plan. You can add the appointment to Nura's calendar. Its summary page shows what you've reported and questions you may want to discuss, and you can export it to bring along. It doesn't interpret your symptoms; it keeps them straight so you can describe them.",
    faqs: [
      {
        q: "Can I bring notes to a GP appointment?",
        a: "Yes, and the NHS recommends it: take your notes and tick each point off during the appointment.",
      },
      {
        q: "How do I describe symptoms clearly?",
        a: "When they started, how often, what makes them better or worse, and how they affect your day. A short diary from the days before helps.",
      },
    ],
    sources: [SRC.whatToAsk],
    related: ["questions-to-ask-your-doctor", "how-to-keep-track-of-symptoms-between-appointments", "how-to-keep-a-list-of-your-medications"],
  },
  {
    slug: "how-to-remember-what-the-doctor-said",
    category: "appointments",
    question: "How to remember what the doctor said",
    title: "How to remember what the doctor said",
    description:
      "Repeat it back before you leave, write it down straight after, ask for the letter, and turn each instruction into a dated next step.",
    answer:
      "Repeat the plan back before you leave, write down what was said and what happens next as soon as you're out of the room, and ask for copies of any letters, which you're entitled to see.",
    why:
      "Appointments are often stressful, and stress is bad for memory. People commonly leave remembering the diagnosis but not the instructions: what to watch for, when to come back, what to do if it gets worse. By the time a question comes up, the details have blurred, and \"I think they said two weeks\" is hard to act on.",
    steps: [
      {
        title: "Check you understood before you leave",
        body: "The NHS suggests saying something like \"Can I just check I understood what you said?\" and repeating the plan in your own words.",
      },
      {
        title: "Write it down within the hour",
        body: "What was discussed, what was decided, and what happens next and when. The NHS advises keeping these notes.",
      },
      {
        title: "Ask for the letter",
        body: "Clinic letters to your GP usually summarise the plan. The NHS notes you're entitled to copies of letters written about you.",
      },
      {
        title: "Separate instructions from information",
        body: "\"Rest for a week\" and \"come back if the swelling spreads\" are things to do or watch for. Pull them out into a short list.",
      },
      {
        title: "Put dates on everything",
        body: "Follow-up appointments, when to expect results, when to start or stop something. An instruction without a date is the one that slips.",
      },
      {
        title: "Ask who to contact",
        body: "If you can't remember something later, you'll want to know who to ask.",
      },
    ],
    avoid: [
      "Relying on a family member to remember for you, unless they're writing it down.",
      "Searching online to fill a gap in what you remember. Ask the clinic instead.",
      "Recording an appointment without asking first. Ask the clinician if you'd like to record it.",
    ],
    nura:
      "Right after the appointment, record a voice note to Nura or type what you remember, or send a photo of the letter or a Word or PDF document. Nura keeps it in a Care plan, asks you to confirm any clinician instructions before treating them as reminders, and then checks in on the next steps when they're due, by call, WhatsApp or in the app.",
    faqs: [
      {
        q: "Am I allowed to see my clinic letters?",
        a: "Yes. The NHS says you're entitled to see letters written about you; ask for copies.",
      },
      {
        q: "What if the instructions were unclear?",
        a: "Contact the practice or clinic and ask. It's much safer than guessing.",
      },
    ],
    sources: [SRC.whatToAsk],
    related: ["questions-to-ask-your-doctor", "how-to-stick-to-a-plan-after-a-doctors-appointment", "how-to-follow-up-on-test-results"],
  },
  {
    slug: "how-to-follow-up-on-test-results",
    category: "appointments",
    question: "How to follow up on test results (and what to do if you hear nothing)",
    title: "How to follow up on test results",
    description:
      "Ask how and when results will arrive and who to chase, check the NHS App, and contact your GP surgery if you haven't heard or don't understand them.",
    answer:
      "When a test is done, ask how and when you'll get the result and who to contact if you don't; then check the NHS App or your GP surgery when that date comes, and ask if the result isn't there.",
    why:
      "\"No news is good news\" is a risky assumption. Results can be delayed, sent to the wrong place, or come back to a GP surgery without anyone telling you. The NHS's own guidance is that if you don't get results when you expect them, you should ask for them. The hard part is remembering, weeks later, that you were waiting.",
    steps: [
      {
        title: "Ask three questions at the time of the test",
        body: "What is it for? How and when will I get the result? Who do I contact if I don't? These are on the NHS's own checklist.",
      },
      {
        title: "Write down the date you should hear by",
        body: "Put a reminder for that date, not for \"sometime soon\".",
      },
      {
        title: "Check online if you can",
        body: "In England, you can see results shared with your GP surgery in the NHS App or your NHS account if you're registered with a GP and aged 16 or over.",
      },
      {
        title: "Know what you won't see",
        body: "Hospital results that haven't been sent to your GP surgery won't appear in your GP record; the hospital may contact you or tell you how to get them.",
      },
      {
        title: "Chase it",
        body: "If the date passes, contact the surgery or clinic. Ask what the result means and what, if anything, you need to do.",
      },
    ],
    avoid: [
      "Assuming silence means everything's fine.",
      "Interpreting a result yourself from a reference range online. The NHS advises contacting your GP surgery if you're not sure what a result means.",
      "Waiting for the next routine appointment to ask.",
    ],
    nura:
      "Tell Nura you're waiting on a result and when you were told to expect it, and it schedules a check-in for that date to ask whether it's arrived. If it hasn't, the check-in is your prompt to contact the surgery. Nura won't interpret results; it makes sure the follow-up happens.",
    faqs: [
      {
        q: "Can I see my test results in the NHS App?",
        a: "In England, yes, for results shared with your GP surgery, if you're registered with a GP and aged 16 or over. Older results may need to be requested from the surgery.",
      },
      {
        q: "Who should I ask what a result means?",
        a: "Your GP surgery, or the clinic that ordered the test.",
      },
    ],
    sources: [SRC.testResults, SRC.whatToAsk],
    related: ["questions-to-ask-your-doctor", "how-to-remember-what-the-doctor-said", "how-to-keep-track-of-symptoms-between-appointments"],
  },
  {
    slug: "how-to-stick-to-a-plan-after-a-doctors-appointment",
    category: "appointments",
    question: "How to stick to a new routine after a doctor's appointment",
    title: "How to stick to a plan after an appointment",
    description:
      "Turn the advice into one small daily step, tie it to a time, track it, and plan who to tell if it isn't working, so the advice survives the first busy week.",
    answer:
      "Turn the advice into the smallest specific step you can do today, attach it to a time or an existing habit, keep a simple record, and set a date to check whether it's working, with who to contact if it isn't.",
    why:
      "Advice from an appointment arrives all at once (move more, take this, cut back on that, come back in six weeks) and then meets real life. The first busy week is when most of it quietly drops. That's not a willpower problem. Vague goals (\"be more active\") are hard to act on; specific ones (\"walk to the corner shop after lunch\") are not.",
    steps: [
      {
        title: "Write down exactly what was advised",
        body: "In the clinician's words if you can, from the letter or your notes. If something is unclear, ask the practice rather than guessing.",
      },
      {
        title: "Pick one change to start",
        body: "If there are several, start with the one that matters most or is easiest, and add the next once it's steady.",
      },
      {
        title: "Make it specific and small",
        body: "What, when, where. \"Do the knee exercises after breakfast at the kitchen table\" survives a busy week; \"do the exercises\" doesn't.",
      },
      {
        title: "Attach it to something you already do",
        body: "A step that follows a fixed part of your day doesn't need remembering.",
      },
      {
        title: "Keep a record",
        body: "Tick it off. It shows you the pattern, and it's what you'll want to tell the clinician at the follow-up.",
      },
      {
        title: "Know when to go back",
        body: "Ask at the appointment when to expect improvement and who to contact if things get worse. Put that date in your diary.",
      },
    ],
    avoid: [
      "Changing everything on day one.",
      "Quietly dropping advice that isn't working instead of telling the clinician. They can adjust the plan only if they know.",
      "Waiting for motivation. Routines run on cues, not mood.",
    ],
    nura:
      "This is what Nura is built for. Tell it what the appointment was about and what you were asked to do, in a message, a voice note or a photo of the letter, and it becomes a Care plan with a next step. Nura then checks in by phone call, WhatsApp or in the app, at a time that suits you (it remembers what \"after work\" means for you), shrinks the step if you're overwhelmed, and keeps a record you can take to the follow-up.",
    faqs: [
      {
        q: "How long does it take for a new routine to stick?",
        a: "It varies a lot from person to person and habit to habit. Focus on doing the small step most days rather than counting to a target.",
      },
      {
        q: "What if the advice isn't working for me?",
        a: "Contact the clinician or practice who gave it. Tell them what you've done and what happened; that's useful information for them.",
      },
    ],
    sources: [SRC.whatToAsk],
    related: ["how-to-build-a-new-health-habit", "how-to-remember-what-the-doctor-said", "how-to-stick-to-physio-exercises-at-home"],
  },
];
