import { SRC } from "../sources";
import type { Guide } from "../types";

export const SYMPTOM_GUIDES: Guide[] = [
  {
    slug: "how-to-keep-track-of-symptoms-between-appointments",
    category: "symptoms",
    question: "How to keep track of symptoms between appointments",
    title: "How to track symptoms between appointments",
    description:
      "Keep a short symptom diary: what happened, when, how long, what helped or made it worse. Record it as it happens, not the night before your appointment.",
    answer:
      "Keep a short, regular record of what you notice: what happened, when it started, how long it lasted, what made it better or worse, and how it affected your day, written as it happens rather than remembered later.",
    why:
      "The NHS suggests writing down details of your symptoms before an appointment, including when they started and what makes them better or worse. The difficulty is that by the time you sit down to do that, the details have blurred together. Bad days feel like every day, and a week where things eased is forgotten. A record kept at the time is far more useful to a clinician than a summary reconstructed in the waiting room.",
    steps: [
      {
        title: "Decide what you're tracking",
        body: "The symptom or symptoms the clinician asked you to watch, plus anything new. Keep the list short so you actually keep it up.",
      },
      {
        title: "Record the same few details each time",
        body: "Date and time, what it was, how long it lasted, what you were doing, what helped or made it worse, and how much it got in the way of your day, in your own words.",
      },
      {
        title: "Write it when it happens",
        body: "A ten-second note in the moment beats a careful entry at the end of the week. Voice notes work well for this.",
      },
      {
        title: "Note good days too",
        body: "\"No problems today\" is information. Without it, a record of only bad days looks worse than reality.",
      },
      {
        title: "Note changes in medicines or routine",
        body: "A new medicine, a missed dose, poor sleep or a stressful week can all sit alongside symptoms; write them down so the pattern is visible.",
      },
      {
        title: "Summarise before the appointment",
        body: "Read back through and note what changed, what stayed the same and your questions. Bring the record as well as the summary.",
      },
    ],
    avoid: [
      "Scoring every symptom on several scales. Over-complicated diaries get abandoned within a week.",
      "Using the diary to diagnose yourself. It's a record for you and your clinician, not a test.",
      "Waiting for the next appointment when something gets worse. If symptoms worsen, contact your GP or NHS 111, or 999 (911 in the US) in an emergency.",
    ],
    nura:
      "Nura is a low-effort way to keep this record: send a message, a WhatsApp or a voice note of up to five minutes when something happens, or answer when Nura checks in, and it keeps the updates together in the Care plan. Before the appointment, the summary page shows what you've reported, patterns you've mentioned, and questions you may want to discuss, which you can export. It reflects back what you told it; it doesn't diagnose.",
    faqs: [
      {
        q: "What should a symptom diary include?",
        a: "When it happened, what it was, how long it lasted, what made it better or worse, and how it affected your day. Add medicines, sleep and anything unusual about the day.",
      },
      {
        q: "Should I bring my symptom diary to the GP?",
        a: "Yes. The NHS recommends bringing notes about your symptoms, including when they started and what makes them better or worse.",
      },
    ],
    sources: [SRC.whatToAsk, SRC.nhs111],
    related: ["who-to-contact-when-symptoms-change-between-appointments", "how-to-prepare-for-a-gp-appointment", "questions-to-ask-your-doctor"],
  },
  {
    slug: "who-to-contact-when-symptoms-change-between-appointments",
    category: "symptoms",
    question: "Symptoms changed between appointments? Who to contact",
    title: "Who to contact if symptoms change",
    description:
      "Use the contact you were given at your appointment, your GP surgery, a pharmacist or NHS 111, and call 999 (911 in the US) in a life-threatening emergency.",
    answer:
      "Start with the contact you were given at your appointment for \"if things get worse\"; otherwise contact your GP surgery, a pharmacist for medicine questions, or NHS 111 when you need help now and can't reach your GP. Call 999 (911 in the US) for a life-threatening emergency.",
    why:
      "When symptoms change, the hardest part is often not knowing whether it's \"worth bothering\" anyone, or who the right person is. Many people wait for the next routine appointment. The NHS's checklist for appointments includes asking \"Who do I contact if things get worse?\" precisely because that answer is hard to find in the moment. Nobody but a clinician can tell you what a change means; your job is to get it to the right one.",
    steps: [
      {
        title: "Check what you were told",
        body: "Look at your notes or clinic letter for a named contact, a ward or clinic number, or instructions for what to do if symptoms change.",
      },
      {
        title: "Your GP surgery",
        body: "For changes that aren't an emergency, contact your GP surgery as you normally would, by phone, online form or the NHS App.",
      },
      {
        title: "A pharmacist",
        body: "For questions about your medicines, including side effects, a pharmacist can advise and refer you on if needed.",
      },
      {
        title: "NHS 111",
        body: "In the UK, NHS 111 online or by phone can help if you think you need medical help right now, including when your GP is closed. It will direct you to the right place.",
      },
      {
        title: "999 or 911",
        body: "Call 999 in the UK, or 911 in the US, for life-threatening emergencies. In the UK, if you're not sure whether you need 999, NHS 111 can help.",
      },
      {
        title: "Write down what changed",
        body: "When it started, what's different and what you've tried. Whoever you contact will ask.",
      },
    ],
    avoid: [
      "Waiting for your next routine appointment because you don't want to be a bother.",
      "Searching your symptoms and deciding for yourself that it's nothing, or that it's serious.",
      "Using an app, including Nura, in place of urgent care. Apps don't assess symptoms.",
    ],
    nura:
      "Nura isn't a symptom checker and doesn't assess urgency. What it does: if you tell it during a check-in that symptoms are getting worse, it encourages you to contact your clinician, and if you mention things like chest pain, trouble breathing, stroke-like symptoms or immediate danger, it tells you to contact emergency services straight away rather than carrying on with the check-in. It also keeps your record of what changed so you can describe it.",
    faqs: [
      {
        q: "When should I call 111 instead of my GP?",
        a: "In the UK, NHS 111 helps when you think you need medical help right now and can't contact your GP, including out of hours. For non-urgent changes, contact your GP surgery.",
      },
      {
        q: "What counts as a 999 emergency?",
        a: "The NHS describes 999 as for life-threatening emergencies, such as serious accidents, strokes and heart attacks. If you're not sure, NHS 111 can help you decide.",
      },
    ],
    sources: [SRC.nhs111, SRC.nhs999, SRC.whatToAsk, SRC.pharmacies],
    related: ["how-to-keep-track-of-symptoms-between-appointments", "what-to-do-after-being-discharged-from-hospital", "questions-to-ask-your-doctor"],
  },
];

export const RECOVERY_GUIDES: Guide[] = [
  {
    slug: "what-to-do-after-being-discharged-from-hospital",
    category: "recovery",
    question: "What to do after being discharged from hospital: a checklist",
    title: "After hospital discharge: a checklist",
    description:
      "Give your GP the discharge letter, sort repeat prescriptions before hospital medicine runs out, know your next steps, and who to call if things go wrong.",
    answer:
      "Make sure your GP gets the discharge letter, arrange a repeat prescription before the medicine you were sent home with runs out, know the next steps in your care and who to contact if something goes wrong, and have someone check on you in the first days.",
    why:
      "Leaving hospital is a handover, and handovers are where things drop. You go home tired, often with new medicines, sometimes with equipment, and a letter that's easy to leave in a bag. The NHS notes that medicine to take home usually covers about 7 days, so a repeat prescription needs arranging quickly, and GP surgeries need notice to issue one.",
    steps: [
      {
        title: "Before you leave the ward",
        body: "The NHS says staff should make sure you know the next steps in your care and how to get help from the hospital, have the medicine and equipment you need and know how to use it, and that information about your care is shared with your GP. Ask if any of that isn't clear.",
      },
      {
        title: "Give your GP the letter",
        body: "You'll usually be given a letter for your GP about your treatment and future care. The NHS advises giving it to your GP as soon as possible.",
      },
      {
        title: "Sort your medicines in the first days",
        body: "Hospital supplies are usually for about 7 days. If you need to keep taking a medicine, arrange a repeat prescription from your GP before it runs out; the NHS suggests ordering up to 5 working days ahead. A pharmacist can help with newly prescribed medicines.",
      },
      {
        title: "Update your medicines list",
        body: "Write down anything new, changed or stopped, and why.",
      },
      {
        title: "Know your follow-up",
        body: "Appointments, tests, dressing changes, and when each is due. Put dates in your diary.",
      },
      {
        title: "Line up support",
        body: "The NHS suggests asking a friend or relative to stay or visit regularly, and making sure you have food, drink and essentials in.",
      },
      {
        title: "Know who to call",
        body: "Keep the ward or clinic number with your letter, and know when to use your GP, NHS 111 or 999.",
      },
    ],
    avoid: [
      "Assuming the hospital and GP will sort the medicines between them. Check.",
      "Leaving the discharge letter in your bag.",
      "Doing too much in the first days. The NHS notes it's normal to feel very tired after an operation.",
    ],
    nura:
      "Send Nura a photo of your discharge letter, or tell it what the ward said, and it turns the follow-up into a Care plan: when to order the repeat prescription, when appointments are, what you were asked to watch. It checks in on each step when it's due. If you'd like, you can invite a family member or friend to that Care plan so they can see its progress; they never see your conversation with Nura.",
    faqs: [
      {
        q: "How long does medicine from the hospital last?",
        a: "The NHS says you'll usually be given enough for the following 7 days, so arrange a repeat prescription from your GP before it runs out.",
      },
      {
        q: "What if I need care at home after leaving hospital?",
        a: "Hospital staff should discuss this with you before you leave. You may be offered short-term care after a needs assessment; your local council arranges longer-term care assessments.",
      },
    ],
    sources: [SRC.discharge, SRC.planningToLeave, SRC.repeatPrescription],
    related: ["checking-on-a-parent-after-a-hospital-stay", "how-to-recover-from-surgery-at-home", "how-to-keep-a-list-of-your-medications"],
  },
  {
    slug: "how-to-recover-from-surgery-at-home",
    category: "recovery",
    question: "How to look after yourself recovering from surgery at home",
    title: "Recovering from surgery at home",
    description:
      "Follow your wound and activity instructions, move as advised, know the warning signs to act on, and keep track of follow-ups in the weeks after surgery.",
    answer:
      "Follow the specific instructions you were given about your wound, washing and activity, get moving as your doctor advised, know which warning signs mean you should get help, and keep track of your follow-up appointments.",
    why:
      "Recovery instructions are given on the day you're least able to take them in. At home, the questions start: can I shower yet, how much should I be doing, is this normal? The NHS notes that feeling very tired is common, that it's important to move around as soon as possible following your doctor's advice, and that your doctor will have given you an idea of how long recovery takes. Your own instructions always come first; general guidance only fills gaps.",
    steps: [
      {
        title: "Find your written instructions",
        body: "Discharge letter, wound care sheet, exercise leaflet. If you didn't get them or they're unclear, ring the ward or your GP surgery.",
      },
      {
        title: "Look after the wound as instructed",
        body: "Follow the nurse's instructions for dressings. The NHS says not to get the wound under water, such as in a bath or swimming pool, until it has healed or your doctor says it's safe.",
      },
      {
        title: "Move as advised",
        body: "Do only as much as you feel able to, but try to move around and follow your doctor's advice on getting active again. Ask what exercises you should be doing.",
      },
      {
        title: "Know the signs to act on",
        body: "The NHS lists signs of a possible blood clot after an operation, such as pain or swelling in a leg, the skin feeling hot or discoloured, or veins near the surface looking larger, and says to seek medical help immediately if you notice them. Ask the ward what else to watch for after your particular operation.",
      },
      {
        title: "Track your follow-ups",
        body: "Stitches or clip removal, wound checks, outpatient appointments, physiotherapy. Put each in your diary.",
      },
      {
        title: "Get back to routine gradually",
        body: "The NHS suggests getting back to your regular routine as soon as you can, eating well and stopping smoking if you smoke.",
      },
    ],
    avoid: [
      "Following a friend's recovery timeline. Different operations, and different people, recover differently.",
      "Pushing through severe or worsening pain without telling anyone.",
      "Staying in bed \"to be safe\" when you've been told to get moving.",
    ],
    nura:
      "Tell Nura about the operation and the instructions you were given, or send a photo of the leaflet, and it keeps them in a recovery Care plan. It checks in on how you're doing and on each follow-up step, and keeps a record of how recovery is going for your next appointment. If you tell it things are getting worse, it encourages you to contact your clinician; for emergency signs it tells you to get help straight away.",
    faqs: [
      {
        q: "When can I shower after surgery?",
        a: "Follow what your doctor or nurse told you. The NHS says you can usually shower 48 hours after surgery unless you've been advised not to.",
      },
      {
        q: "Is it normal to feel exhausted after an operation?",
        a: "The NHS says not to be surprised if you feel very tired at home, especially after a major operation or a general anaesthetic. Tell your GP if anything worries you.",
      },
    ],
    sources: [SRC.surgeryRecovery, SRC.discharge, SRC.nhs111],
    related: ["what-to-do-after-being-discharged-from-hospital", "how-to-stick-to-physio-exercises-at-home", "who-to-contact-when-symptoms-change-between-appointments"],
  },
  {
    slug: "how-to-stick-to-physio-exercises-at-home",
    category: "recovery",
    question: "How to stick to your physio exercises at home",
    title: "How to stick to physio exercises at home",
    description:
      "Do the exercises at a fixed time, keep the sheet where you'll do them, log each session, and tell your physiotherapist what's hard rather than quietly stopping.",
    answer:
      "Do them at the same time each day, straight after something you already do, keep the exercise sheet where you'll do them, tick off each session, and tell your physiotherapist what's difficult rather than quietly stopping.",
    why:
      "Exercises are a common part of physiotherapy treatment, and most of them happen at home, between sessions. They're repetitive, sometimes uncomfortable, and progress is slow enough to be invisible day to day, which is exactly the kind of task that slips. There can also be a wait for NHS physiotherapy, which makes the exercises you've already been given even more important to keep up.",
    steps: [
      {
        title: "Get the exercises written down",
        body: "Ask for a sheet or a link with pictures, and how many times and how often. Don't rely on memory from the session.",
      },
      {
        title: "Fix a time and a place",
        body: "\"After my morning coffee, on the living room floor\" is a plan. Keep the sheet and anything you need right there.",
      },
      {
        title: "Start with the minimum",
        body: "On a bad day, doing one round is better than skipping. Consistency matters more than the perfect session.",
      },
      {
        title: "Log it",
        body: "A tick on a calendar. It shows you progress you can't feel yet, and it's what your physiotherapist will ask about.",
      },
      {
        title: "Note what hurts or is hard",
        body: "Which exercise, what you felt and when. Bring it to your next session.",
      },
      {
        title: "Ask before changing anything",
        body: "If an exercise seems too easy, too hard or painful, ask your physiotherapist rather than adapting it yourself.",
      },
    ],
    avoid: [
      "Doing a big catch-up session after missing several days.",
      "Stopping because it hurts without telling your physiotherapist.",
      "Waiting until the next appointment to admit you haven't been doing them. They can adjust the plan if they know.",
    ],
    nura:
      "Nura can check in at the time you choose, every day or on weekdays, by phone call, WhatsApp or in the app, and ask whether you've done the exercises. It keeps a record of how it's going and what you said was hard, so you can bring that to your next session. It won't change your exercises; that's your physiotherapist's job.",
    faqs: [
      {
        q: "Can I refer myself for NHS physiotherapy?",
        a: "In many areas of England you can get physiotherapy from NHS community musculoskeletal (MSK) services without a GP referral. Your GP surgery can tell you what's available.",
      },
      {
        q: "What if the exercises are painful?",
        a: "Tell your physiotherapist what you're feeling and when. Don't push through pain or change the exercises without asking.",
      },
    ],
    sources: [SRC.physiotherapy, SRC.surgeryRecovery],
    related: ["how-to-recover-from-surgery-at-home", "how-to-build-a-new-health-habit", "how-to-stick-to-a-plan-after-a-doctors-appointment"],
  },
];
