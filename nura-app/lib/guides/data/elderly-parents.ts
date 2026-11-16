import { SRC } from "../sources";
import type { Guide } from "../types";
import { CARE_FOR_TEASER, IMG, TRY_LINK, media, teaser } from "./media";

/** Looking out for an older parent, mostly from a distance. Companion framing, never clinical. */
export const ELDERLY_PARENT_GUIDES: Guide[] = [
  {
    slug: "worried-about-elderly-parent-living-alone",
    category: "elderly",
    question: "Worried about an elderly parent living alone? What to do",
    title: "Worried about a parent living alone?",
    description:
      "Turn a vague worry into a plan: what to look for, how to talk about it without a row, who can help, and how to hear how they are without ringing daily.",
    answer:
      "Start by naming what you're actually worried about (falls, eating, loneliness, forgetting things, or just not hearing from them), then talk to your parent about it, agree a regular way of keeping in touch, and line up practical help such as a personal alarm or a free council needs assessment. Most worry eases once there's a plan and someone notices early when something changes.",
    why:
      "The worry is often vague, which makes it hard to act on. You see your parent on a good day, or hear a cheerful voice on the phone, and can't tell whether things are fine or quietly slipping. Bringing it up can feel like accusing them of not coping, and many older people play things down because they don't want to be a burden or lose their independence. Meanwhile you're juggling your own work and family, sometimes hours away.",
    sections: [
      {
        heading: "What are the signs an elderly parent is struggling at home?",
        paras: [
          "No single sign means your parent can't live alone, but a pattern is worth a conversation. Things families often notice:",
        ],
        list: [
          "Less food in the fridge, out-of-date food, or weight loss. The NHS lists unintentional weight loss and a lack of interest in eating and drinking among common signs of malnutrition, and says people aged 65 and over are particularly at risk.",
          "Post piling up, bills unpaid, or the house much less tidy than usual.",
          "Bruises, a new reluctance to use the stairs, or mentions of \"a little slip\".",
          "Seeing friends less, dropping groups or hobbies, sounding flat on the phone.",
          "Missed appointments, repeat questions, or confusion about days.",
        ],
      },
      {
        heading: "How do you bring it up without a row?",
        paras: [
          "Lead with what you've noticed and how you feel, not a verdict: \"I noticed the fridge was nearly empty and I've been worrying about you\" lands better than \"You're not eating properly.\" Ask what they find hard and what would help. It's their home and their decision, and people accept help more readily when they've chosen it.",
          "Pick one thing to change first. A regular call, a key safe or a weekly shopping delivery is easier to say yes to than a whole new arrangement.",
        ],
      },
    ],
    steps: [
      {
        title: "Write down the specific worry",
        body: "\"I don't know if she's eating\" points to a different fix than \"I'm scared he'll fall and no one will know.\" Be specific so the help matches the problem.",
      },
      {
        title: "Talk to your parent first",
        body: "Ask what they'd find reassuring rather than intrusive. Some people like a morning call; others would rather a text, or a visit twice a week.",
      },
      {
        title: "Agree a rhythm of contact",
        body: "A regular time to be in touch makes it easier to notice when something is off, without it feeling like a test.",
      },
      {
        title: "Cover the emergency gap",
        body: "Regular calls can't catch a fall between them. The NHS describes personal alarms, including ones that alert a family member's phone or a 24-hour monitoring service, and key safes so family or emergency services can get in.",
      },
      {
        title: "Ask the council for a needs assessment",
        body: "It's free, anyone can ask, and it's the route to things like help at home or equipment. If they don't qualify, the council should still give free advice on local help.",
      },
      {
        title: "Share it out",
        body: "Siblings, grandchildren, a neighbour or a friend from church or the club. Write down who checks when so there are no gaps.",
      },
    ],
    avoid: [
      "Deciding for them. Plans made without your parent tend to be quietly ignored.",
      "Making every call a health check. They'll start dreading it and tell you less.",
      "Installing cameras or tracking without their agreement.",
      "Carrying all the worry alone until you burn out.",
    ],
    nura:
      "Nura can do some of the regular checking in for you. You start a Care plan about your parent with their first name and number and send them a link; Nura only calls once they tap Yes (or you confirm they've agreed). Calls ring only between 9am and 8pm their time, Nura asks how things are going, and you get a short summary of each call. They can say \"stop\" on any call. It isn't an alarm or an emergency service, so it works alongside those, not instead of them.",
    faqs: [
      {
        q: "When should an elderly parent stop living alone?",
        a: "There's no set age. It's usually when daily routines, safety or health can't be managed even with help at home, adaptations and alarms. A council needs assessment can help you and your parent judge that together.",
      },
      {
        q: "Can I make my parent accept help?",
        a: "If they have capacity to decide, no; it's their choice. You can explain your worries, offer options and keep the door open.",
      },
      {
        q: "Who can I talk to about my worries?",
        a: "Your local council's adult social services, and in the UK charities such as Age UK and Independent Age run free helplines.",
      },
    ],
    sources: [SRC.malnutrition, SRC.alarms, SRC.needsAssessment, SRC.lonely],
    related: [
      "how-to-check-on-an-elderly-parent-who-lives-alone",
      "can-my-elderly-parent-live-alone",
      "how-to-monitor-elderly-parent-at-home",
      "daily-check-in-calls-for-elderly-parents",
    ],
    media: media(
      IMG.tryMum,
      "A real plan from the try-it box on Nura's home page, written from one sentence about a mum who lives alone two hours away.",
      TRY_LINK,
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "can-my-elderly-parent-live-alone",
    category: "elderly",
    question: "Can my elderly parent still live alone? How to decide together",
    title: "Can my elderly parent still live alone?",
    description:
      "The questions that matter more than age: daily routines, safety, eating, company and help nearby. Plus the support that lets many people stay at home.",
    answer:
      "Many older people live alone safely, especially with the right support. The useful question isn't age but whether your parent can manage daily routines (washing, dressing, eating, medicines, getting out), stay reasonably safe, and get help quickly if something goes wrong. If the answer is \"not quite\", help at home, adaptations, alarms and regular contact often close the gap before a move is needed.",
    why:
      "Families often frame it as a yes-or-no choice between staying at home and moving to a care home, which makes the conversation feel enormous and frightening. In reality there's a wide middle ground. The NHS describes paid carers who visit for anything from an hour a week to several hours a day, home adaptations and equipment, and alarms and sensors that alert family. The decision is also your parent's, not yours, if they're able to make it.",
    sections: [
      {
        heading: "Questions to work through together",
        paras: ["Go through these with your parent rather than about them:"],
        list: [
          "Daily routines: can they wash, dress, get to the toilet and get in and out of bed without struggling?",
          "Food and drink: are they eating proper meals and drinking enough through the day?",
          "Medicines: are they taking them as prescribed, and getting repeat prescriptions in time?",
          "Safety: have there been falls or near misses? Are stairs, the bath or clutter a risk?",
          "Getting out: can they shop, get to appointments and see people?",
          "Company: do they talk to someone most days? The NHS notes older people are particularly at risk of loneliness if they live alone or don't have regular contact with others.",
          "Help in an emergency: if they fell tonight, how would anyone know?",
        ],
      },
      {
        heading: "What support helps an elderly parent keep living at home?",
        paras: [
          "The NHS describes homecare (a paid carer visiting to help with things like getting up, washing, meals and remembering medicines), which it says costs from about £15 to £30 an hour depending on where you live, with the council sometimes contributing. It also covers personal alarms, monitoring systems and key safes, and home adaptations.",
          "A council needs assessment is the starting point for council-funded help, and the NHS suggests it's worth having even if you plan to arrange care privately, because it helps you explain what's needed.",
        ],
      },
    ],
    steps: [
      {
        title: "Have the conversation early",
        body: "Talk before a crisis forces a decision. Ask what matters most to them about staying at home.",
      },
      {
        title: "Look at a normal week",
        body: "Use the questions above. Note what's going fine as well as what isn't, so the conversation isn't all about decline.",
      },
      {
        title: "Fix the specific gaps",
        body: "A grab rail, a shopping delivery, a weekly cleaner, a paid carer for mornings, or a personal alarm. Small fixes often make a big difference.",
      },
      {
        title: "Get a needs assessment",
        body: "Ask adult social services at their local council. It's free, and it tells you what support they may be entitled to.",
      },
      {
        title: "Agree how you'll keep in touch",
        body: "Regular contact is how you notice change early, and it's company as much as checking.",
      },
      {
        title: "Review it every few months",
        body: "Needs change. Agree to look at it again, especially after an illness, a fall or a hospital stay.",
      },
    ],
    avoid: [
      "Treating it as a single all-or-nothing decision.",
      "Waiting for a fall or a hospital stay to start the conversation.",
      "Deciding on your parent's behalf when they can decide for themselves.",
    ],
    nura:
      "Nura helps with the keeping-in-touch part. With your parent's agreement, it gives them a short call in their daytime (only between 9am and 8pm their time) and tells you how it went, so you notice changes between your own calls and visits. You can invite a sibling to the same Care plan so you both see how things are going. It doesn't assess whether someone can live alone; that's a conversation for your family and, if needed, the council.",
    faqs: [
      {
        q: "Is there an age when elderly people shouldn't live alone?",
        a: "No. It depends on how someone is managing, not their age, and on what support is in place.",
      },
      {
        q: "What if my parent wants to stay home but I think it's unsafe?",
        a: "Share your specific concerns, suggest support that addresses them, and ask the council for a needs assessment. If they can make the decision, it's theirs to make.",
      },
    ],
    sources: [SRC.homecare, SRC.alarms, SRC.needsAssessment, SRC.lonely, SRC.careHomes],
    related: [
      "worried-about-elderly-parent-living-alone",
      "how-to-get-help-at-home-for-an-elderly-parent",
      "how-to-talk-to-a-parent-about-needing-more-help",
      "how-to-check-on-an-elderly-parent-who-lives-alone",
    ],
    media: media(
      IMG.checksInWithMargaret,
      "Nura's \"check in on someone you care for\": calls only in their daytime, only after they say yes, and they can say stop on any call.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "how-to-monitor-elderly-parent-at-home",
    category: "elderly",
    question: "How to keep an eye on an elderly parent at home, remotely",
    title: "How to monitor an elderly parent remotely",
    description:
      "Alarms, sensors, check-in calls and video calls compared, plus how to choose the least intrusive option your parent will actually agree to.",
    answer:
      "Pick the lightest option that covers your real worry, and agree it with your parent. Personal alarms and fall detectors cover emergencies; home sensors that alert family cover \"has anything changed?\"; regular check-in calls cover \"how are they actually doing?\"; and a shared rota with family and neighbours covers the rest. Cameras are rarely needed and should never go in without their agreement.",
    why:
      "Remote monitoring sounds like one product, but it's several different things that answer different questions. A fall alarm can't tell you your mum's been low for a fortnight, and a weekly phone call can't tell you she fell at 3am. Families often buy the most powerful option, find their parent hates it, and end up with an unused gadget and a strained relationship.",
    sections: [
      {
        heading: "The main options, and what each one is for",
        paras: ["The NHS groups the technology into personal alarms, monitoring systems (telecare) and key safes. Alongside those sit ordinary ways of keeping in touch:"],
        list: [
          "Personal alarms: worn or carried, or a button or pull cord at home. Some make a noise, some alert a family member's phone, some alert a 24-hour monitoring service. Fall detectors and GPS alarms exist too.",
          "Monitoring systems: sensors for movement, doors opening, room temperature, flooding, smoke or gas, or appliances left on, that alert family, carers or a monitoring service.",
          "Key safes: so family, carers or emergency services can get in if your parent can't reach the door.",
          "Check-in calls: a regular call, from family, a befriending service or an automated or AI service, that asks how they are.",
          "Video calls: good for company and seeing someone's face, if your parent is comfortable with the tech.",
        ],
      },
      {
        heading: "How do you choose?",
        paras: [
          "Ask your parent what would make them feel safer, then match the option to the worry. Emergencies need an alarm. Gradual change needs regular contact by people who know them. The NHS suggests thinking about whether a product is right for the person and whether they're comfortable using it. Some councils provide basic monitoring services after a home assessment.",
        ],
      },
    ],
    steps: [
      {
        title: "Name the worry",
        body: "Falls at night? Not eating? Low mood? Leaving the cooker on? Each points to a different tool.",
      },
      {
        title: "Talk to your parent",
        body: "Explain what you're thinking and why. Ask what they'd be happy with. Monitoring someone without their agreement damages trust.",
      },
      {
        title: "Start with one thing",
        body: "A pendant alarm or a regular call is a small step. Add more only if there's a gap.",
      },
      {
        title: "Ask the council",
        body: "Adult social services can tell you if they provide basic monitoring and can arrange a home assessment.",
      },
      {
        title: "Decide who responds",
        body: "Every alert needs a named person who acts on it. Write down who, and what they'll do.",
      },
    ],
    avoid: [
      "Cameras in living spaces without agreement. It's their home.",
      "Collecting alerts nobody reads.",
      "Assuming technology replaces visits and conversation.",
    ],
    nura:
      "Nura covers the \"how are they actually doing?\" part. Once your parent agrees on a link you send, Nura gives them a short, friendly call in their daytime and sends you a summary, so you hear about a bad week before it becomes a crisis. Calls may be recorded and transcribed so Nura can keep track, and your parent can say \"stop\" on any call. Nura isn't an alarm and can't respond to emergencies, so use it alongside an alarm if falls are a worry.",
    faqs: [
      {
        q: "Is it legal to monitor an elderly parent?",
        a: "Monitoring someone who has the capacity to decide should be done with their agreement. If you're unsure, get advice before installing anything that records them.",
      },
      {
        q: "What's the least intrusive way to check on a parent?",
        a: "Usually a regular, agreed time to talk, plus a personal alarm for emergencies.",
      },
    ],
    sources: [SRC.alarms, SRC.needsAssessment, SRC.falls],
    related: [
      "app-to-check-on-elderly-parents",
      "daily-check-in-calls-for-elderly-parents",
      "what-to-do-if-an-elderly-parent-falls",
      "how-to-check-on-an-elderly-parent-who-lives-alone",
    ],
    media: media(
      IMG.howTheyAgree,
      "In Nura, your parent agrees to calls first: you send a link and they tap yes, and calls only happen in their daytime.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "app-to-check-on-elderly-parents",
    category: "elderly",
    question: "What app can I use to check on my elderly parents?",
    title: "Apps to check on elderly parents",
    description:
      "The kinds of app families use (location sharing, alarms, sensors, check-in calls) and the questions to ask before you pick one, including consent.",
    answer:
      "It depends what you want to know. Location-sharing apps tell you where someone is; alarm and sensor apps tell you something has happened; check-in apps and call services tell you how someone is doing. Many parents don't want or can't use a smartphone app, so services that work over an ordinary phone call are often the easiest to say yes to.",
    why:
      "App stores are full of \"senior safety\" apps, and it's hard to tell them apart. Many assume your parent will carry a charged smartphone, keep location on and open the app daily, which isn't how a lot of older people use their phones. The other trap is consent: an app that quietly tracks a parent who hasn't agreed can damage trust badly if they find out.",
    sections: [
      {
        heading: "The main types of app",
        paras: [],
        list: [
          "Location sharing (built into most phones): good for \"did they get home?\", but needs the phone with them and switched on.",
          "Alarm and fall-detection apps or watches: designed for emergencies; check whether alerts go to family or a 24-hour service.",
          "Smart home and sensor apps: alert family to things like no movement in the morning, or a door left open.",
          "Check-in apps: your parent taps \"I'm OK\" each day, and family are told if they don't.",
          "Check-in call services: a call to your parent's ordinary phone, by a person or an automated or AI caller, with a summary sent to you.",
          "Shared family apps: rotas, notes and updates so siblings stay in step.",
        ],
      },
      {
        heading: "What to ask before you choose",
        paras: ["Whatever you pick, check:"],
        list: [
          "Has your parent agreed, and do they know what you'll see?",
          "Does it need a smartphone, an app or a wearable on their side?",
          "What exactly are you told, and when?",
          "Is anything recorded, and who can see it?",
          "How does your parent stop it?",
          "What happens in an emergency? (Most check-in apps aren't emergency services.)",
        ],
      },
    ],
    steps: [
      {
        title: "Decide what you need to know",
        body: "Where they are, that they're safe, or how they're doing. One app rarely does all three well.",
      },
      {
        title: "Match it to how your parent uses a phone",
        body: "If they barely use apps, choose something that works by phone call or needs nothing from them.",
      },
      {
        title: "Ask them",
        body: "Show them what it does and what you'd see. Let them say no.",
      },
      {
        title: "Try it for a few weeks",
        body: "Then ask how it feels for both of you. Drop it if it's causing friction.",
      },
      {
        title: "Keep an emergency plan",
        body: "Know who has a key and how your parent gets help fast. The NHS describes personal alarms and key safes for this.",
      },
    ],
    avoid: [
      "Tracking a parent's location without telling them.",
      "Choosing an app your parent has to remember to open every day.",
      "Relying on an app for emergencies it isn't designed to handle.",
    ],
    nura:
      "Nura is the check-in call kind. You use the app; your parent doesn't need one, or a smartphone. You add their first name and number, send them a link, and once they tap Yes, Nura calls their ordinary phone in their daytime, asks how things are going and sends you a short summary. You can invite siblings to the same Care plan. Calls to someone you care for are part of Nura Plus, which is US$9.99 a month after a 14-day free trial (prices may vary by region).",
    faqs: [
      {
        q: "Do I need my parent's permission to use a check-on-parents app?",
        a: "You should have it. Nura won't call anyone until they've agreed, by tapping Yes on a link or by you confirming they're happy to be called.",
      },
      {
        q: "Is there an app for elderly parents without a smartphone?",
        a: "Yes. Check-in call services work over an ordinary phone, and alarms can be a pendant or a button at home.",
      },
    ],
    sources: [SRC.alarms, SRC.lonely],
    related: [
      "how-to-monitor-elderly-parent-at-home",
      "daily-check-in-calls-for-elderly-parents",
      "how-to-share-the-care-of-a-parent-with-siblings",
      "worried-about-elderly-parent-living-alone",
    ],
    media: media(
      IMG.whoIsThisFor,
      "Setting up \"Someone I care for\" in Nura: their first name, relationship and phone number. They don't need the app.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "elderly-parent-not-eating",
    category: "elderly",
    question: "Elderly parent not eating enough? What you can do",
    title: "Elderly parent not eating enough",
    description:
      "Why older people stop eating well, the signs the NHS says to watch for, practical ways to help from near or far, and when to get them seen.",
    answer:
      "Find out why first: it might be appetite, loneliness, difficulty shopping or cooking, dental or swallowing problems, low mood, or something medical. Then make eating easier (smaller, more frequent meals and snacks, easy food in the house, company at mealtimes) and encourage them to see a GP if they're losing weight without trying, which the NHS lists as one of the main signs of malnutrition.",
    why:
      "Eating less can creep up slowly and is easy to miss from a distance. Your parent may say \"I'm just not hungry\" or \"I had a big lunch.\" The NHS says people aged 65 and over are particularly at risk of malnutrition, that weight loss is not an inevitable part of ageing, and that it's more common in people who are socially isolated, have limited mobility or a low income. So it's often as much about circumstances as appetite.",
    sections: [
      {
        heading: "What signs should you look out for?",
        paras: ["The NHS lists these among the common signs of malnutrition:"],
        list: [
          "Unintentional weight loss (it says losing 5% to 10% or more of weight over 3 to 6 months is one of the main signs). Loose clothes, rings or dentures can be a clue.",
          "A lack of interest in eating and drinking.",
          "Feeling tired all the time, or weak.",
          "Getting ill often and taking a long time to recover.",
        ],
      },
      {
        heading: "When should they see a GP?",
        paras: [
          "The NHS says to see a GP if someone has unintentionally lost a lot of weight over the last 3 to 6 months, has other signs of malnutrition, or if you're worried someone in your care may be malnourished. If you're concerned about a family member, it suggests encouraging them to go. A GP can check their weight and ask about appetite and any medical problems.",
        ],
      },
    ],
    steps: [
      {
        title: "Ask, gently, what's changed",
        body: "Is cooking a chore? Is shopping hard? Do they not fancy eating alone? Are their teeth or dentures sore? The answer tells you what to fix.",
      },
      {
        title: "Make food easy",
        body: "Stock things that need little preparation, set up a supermarket delivery, or look at meal services. The NHS's first dietary advice for malnutrition includes snacking between meals.",
      },
      {
        title: "Add company to meals",
        body: "Eat together when you visit, share a video call over lunch, or look into lunch clubs and day centres.",
      },
      {
        title: "Don't forget drinks",
        body: "The NHS says most people should drink enough that their pee is a clear pale yellow, and that not eating and drinking enough can make you feel lightheaded or faint.",
      },
      {
        title: "Notice the trend",
        body: "Keep a simple note of what you hear: \"skipped lunch again\", \"had soup\". A pattern over a few weeks is more useful than one bad day.",
      },
      {
        title: "Encourage a GP visit if weight is dropping",
        body: "Offer to go with them, or help them book it.",
      },
    ],
    avoid: [
      "Turning every call into an interrogation about food.",
      "Assuming eating less is just part of getting old.",
      "Changing their diet or adding supplements without advice from a GP, nurse or dietitian.",
    ],
    nura:
      "If you're far away, Nura can help you notice. With your parent's agreement, it gives them a short call in their daytime and you can set the plan around what you want to know, for example whether they're eating properly and getting out. You get a short summary after each call, so you see the pattern over weeks rather than guessing from one phone call. Nura doesn't assess nutrition or give medical advice; if you're worried about weight loss, the next step is their GP.",
    faqs: [
      {
        q: "Why do elderly people stop eating?",
        a: "Common reasons include reduced appetite, loneliness, difficulty shopping or cooking, mouth or swallowing problems, low mood and medical conditions. The NHS notes malnutrition is more common in people who are isolated, have limited mobility or a low income.",
      },
      {
        q: "What if my parent stops eating and drinking altogether?",
        a: "That needs medical help promptly. Call their GP, or NHS 111 in the UK, and 999 if they're very unwell.",
      },
    ],
    sources: [SRC.malnutrition, SRC.water, SRC.lonely, SRC.nhs111],
    related: [
      "worried-about-elderly-parent-living-alone",
      "how-to-help-a-lonely-elderly-parent",
      "how-to-check-on-an-elderly-parent-who-lives-alone",
      "caring-for-a-parent-from-a-distance",
    ],
    media: media(
      IMG.tryMum,
      "A plan Nura wrote from one sentence: \"I'd like to know she's eating properly and getting out for a walk most days.\"",
      TRY_LINK,
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "how-to-help-a-lonely-elderly-parent",
    category: "elderly",
    question: "How to help a lonely elderly parent",
    title: "How to help a lonely elderly parent",
    description:
      "Practical ways to ease an older parent's loneliness, from regular contact and local groups to befriending services, and how to spot low mood.",
    answer:
      "Make contact regular and predictable, help them find one or two things to look forward to each week (a group, a class, a lunch club, a volunteer role), and introduce befriending services if they'd like more company. Keep an eye on mood too: if they've been low for more than two weeks, the NHS suggests seeing a GP.",
    why:
      "Loneliness is common and often hidden. The NHS says older people are particularly at risk if they live alone or don't have regular contact with others, and lists retirement, illness, bereavement and moving as common causes. Many parents won't say they're lonely, because they don't want to worry you or feel a nuisance. And you can't fill every gap yourself, especially from a distance.",
    sections: [
      {
        heading: "What the NHS suggests for older people",
        paras: ["For older people who feel lonely, the NHS suggests things like:"],
        list: [
          "Keeping in touch by phone or video chat.",
          "Joining local groups, classes or community activities.",
          "Starting small conversations when out, for example in shops.",
          "Inviting someone over, even for a short visit.",
          "Planning things to look forward to and putting them in the diary.",
          "Volunteering.",
          "Support and befriending services from organisations such as Age UK, The Silver Line or Re-engage.",
        ],
      },
      {
        heading: "How can you tell if it's more than loneliness?",
        paras: [
          "The NHS suggests seeing a GP if someone is struggling to cope with stress, anxiety or low mood, has had a low mood for more than 2 weeks, or things they're trying aren't helping. In the UK, people can also refer themselves to NHS talking therapies. If someone needs immediate help, call 999.",
        ],
      },
    ],
    steps: [
      {
        title: "Make contact a routine",
        body: "A call at the same time each week, or a short daily message, gives them something to count on. Predictable beats occasional long calls.",
      },
      {
        title: "Find one regular outing",
        body: "A lunch club, day centre, walking group, faith group or class. Offer to go along the first time.",
      },
      {
        title: "Widen the circle",
        body: "Ask grandchildren, siblings, old friends and neighbours to call or drop in. Share a simple rota.",
      },
      {
        title: "Try befriending",
        body: "Telephone and visiting befriending services exist for exactly this. Your parent chooses whether to try one.",
      },
      {
        title: "Help with the tech, if they want it",
        body: "Set up video calls on a device they're comfortable with. The NHS suggests using technology to stay in touch, but not relying on it alone.",
      },
      {
        title: "Watch mood over time",
        body: "Note if they sound flat for weeks, stop doing things they enjoyed, or talk about not seeing the point. Encourage a GP visit.",
      },
    ],
    avoid: [
      "Telling them to \"just get out more\" without helping them find somewhere to go.",
      "Long gaps followed by guilt-driven marathon calls.",
      "Assuming a busy-sounding parent isn't lonely.",
    ],
    nura:
      "Nura can add a friendly, regular call to the mix. Once your parent says yes on a link you send, Nura calls them in their daytime, asks how things are going and listens, then tells you how it went, so you know how they're really doing and what to talk about next time you ring. It isn't a replacement for family or friends, and your parent can say \"stop\" on any call.",
    faqs: [
      {
        q: "How often should I call a lonely elderly parent?",
        a: "Agree it with them. A predictable rhythm, even a short call at the same time each week, often helps more than occasional long calls.",
      },
      {
        q: "Are there free services for lonely older people in the UK?",
        a: "Yes. The NHS points to support and befriending from organisations including Age UK, The Silver Line and Re-engage.",
      },
    ],
    sources: [SRC.lonely, SRC.fiveSteps],
    related: [
      "daily-check-in-calls-for-elderly-parents",
      "worried-about-elderly-parent-living-alone",
      "caring-for-a-parent-from-a-distance",
      "daily-routine-for-elderly-parents",
    ],
    media: media(
      IMG.checksInWithMargaret,
      "Nura checks in with someone you care for, in their daytime, and tells you how it went.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "how-to-get-help-at-home-for-an-elderly-parent",
    category: "elderly",
    question: "How to get help at home for an elderly parent",
    title: "Getting help at home for an elderly parent",
    description:
      "What homecare covers, what it costs, how to get the council involved with a needs assessment, and how to arrange it yourself if you'd rather.",
    answer:
      "Start with a free needs assessment from your parent's local council. If they're eligible, the council arranges help at home (homecare), and a financial assessment decides what they pay. If not, or if you'd rather, you can arrange a paid carer privately; the NHS says homecare costs from about £15 to £30 an hour depending on where you live.",
    why:
      "Families often don't know where to start, or assume help at home is only for people with very high needs. The NHS describes homecare as flexible: an hour a week or several hours a day, short-term after an illness or long-term, and covering everyday things like getting up, washing, meals, shopping and remembering medicines. Knowing the route makes it far less daunting.",
    sections: [
      {
        heading: "What can a paid carer help with?",
        paras: ["The NHS lists things a paid carer can help with at home, including:"],
        list: [
          "Getting out of bed in the morning, washing and dressing.",
          "Using the toilet.",
          "Preparing meals and drinks.",
          "Remembering to take medicines.",
          "Shopping, and collecting prescriptions or a pension.",
          "Getting out, for example to a lunch club.",
          "Getting settled and ready for bed.",
        ],
      },
      {
        heading: "Homecare, home help or live-in care?",
        paras: [
          "Homecare is personal care. Home help means domestic tasks like cleaning, washing up, laundry and gardening; the NHS notes most councils don't provide home help and suggests charities such as the Royal Voluntary Service, the British Red Cross or a local Age UK, which may charge. Live-in care is for people who need someone there around the clock.",
        ],
      },
    ],
    steps: [
      {
        title: "Ask for a needs assessment",
        body: "Contact adult social services at your parent's local council. It's free and anyone can ask. The NHS suggests it's worth doing even if you plan to arrange care yourself.",
      },
      {
        title: "Ask for a carer's assessment for you",
        body: "If you help your parent, you can have your own assessment, and both can be done at the same time.",
      },
      {
        title: "Expect a financial assessment",
        body: "If homecare is recommended, a means test works out whether the council contributes.",
      },
      {
        title: "Or arrange it privately",
        body: "The council's website may list homecare agencies, and the NHS website lists local and national homecare providers.",
      },
      {
        title: "Agree the details with your parent",
        body: "Times, tasks, what matters to them. Help works best when the person receiving it shaped it.",
      },
      {
        title: "Keep checking it works",
        body: "Note when visits are late, short or missed, and ask for a review if needs change.",
      },
    ],
    avoid: [
      "Waiting until a crisis to look into it.",
      "Arranging care your parent hasn't agreed to.",
      "Assuming nothing can change once it's set up. Ask for a review.",
    ],
    nura:
      "Nura helps with the part between visits and reviews: noticing whether things are actually going well. With your parent's agreement, it gives them a short call in their daytime and tells you how it went, and you can keep notes and next steps in a Care plan your siblings can see. Nura isn't a care agency and doesn't arrange care.",
    faqs: [
      {
        q: "How much does help at home cost?",
        a: "The NHS says homecare costs from about £15 to £30 an hour, varying by area. The council may contribute after a financial assessment.",
      },
      {
        q: "Can a carer help with medicines?",
        a: "The NHS lists remembering to take medicines among the things a paid carer can help with.",
      },
    ],
    sources: [SRC.homecare, SRC.needsAssessment, SRC.carerAssessment, SRC.meansTest],
    related: [
      "what-is-a-care-and-support-plan",
      "can-my-elderly-parent-live-alone",
      "what-is-a-carers-assessment",
      "care-plan-for-elderly-parent-at-home",
    ],
    media: media(
      IMG.tryMum,
      "A real plan from Nura's try-it box: checking in on a mum who lives alone, with a suggested weekly check-in.",
      TRY_LINK,
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "how-to-talk-to-a-parent-about-needing-more-help",
    category: "elderly",
    question: "How to talk to an elderly parent about needing more help",
    title: "Talking to a parent about needing help",
    description:
      "How to raise care, help at home or a move without a row: timing, words that work, listening, and taking it one step at a time.",
    answer:
      "Choose a calm moment, start from what you've noticed and how you feel rather than what they can't do, ask what they find hard and what they'd want, and offer one small, specific option rather than a whole plan. Expect several conversations, and remember that if they can decide for themselves, the decision is theirs.",
    why:
      "To your parent, \"you need help\" can sound like \"you're losing your independence\" or \"you're going into a home.\" Pride, fear and not wanting to be a burden all push them to say they're fine. Siblings may disagree, and the conversation often happens in a rush after a fall or hospital stay, when everyone is frightened.",
    sections: [
      {
        heading: "Words that tend to help",
        paras: [],
        list: [
          "\"I've noticed… and I've been worrying about you.\"",
          "\"What's the hardest part of the day at the moment?\"",
          "\"What would make things easier?\"",
          "\"What matters most to you about staying here?\"",
          "\"Could we try it for a month and see how it feels?\"",
        ],
      },
      {
        heading: "Words that tend to backfire",
        paras: [],
        list: [
          "\"You can't cope any more.\"",
          "\"We've decided…\"",
          "\"It's for your own good.\"",
          "Comparisons with other people's parents.",
        ],
      },
    ],
    steps: [
      {
        title: "Pick the moment",
        body: "Not in the middle of a crisis or a family gathering. A quiet visit or a walk is better.",
      },
      {
        title: "Get siblings on the same page first",
        body: "Agree the main concern and who will lead, so your parent doesn't feel ambushed by mixed messages.",
      },
      {
        title: "Start with what you've noticed",
        body: "Specific, kind and about your feelings: \"I noticed you've stopped going to the club and I've been worried.\"",
      },
      {
        title: "Listen more than you talk",
        body: "Ask what they find hard and what they're afraid of. The real worry might be something you hadn't guessed.",
      },
      {
        title: "Offer one small step",
        body: "A grab rail, a cleaner, a weekly call, a pendant alarm, a needs assessment. Make it a trial.",
      },
      {
        title: "Come back to it",
        body: "Expect several conversations. Keep the door open and check how the first step is going.",
      },
    ],
    avoid: [
      "Making decisions behind their back.",
      "Leading with care homes when smaller help hasn't been tried.",
      "Giving up after one difficult conversation.",
    ],
    nura:
      "If a regular check-in call is the small step your parent agrees to, Nura can be it. They get a link and choose whether to say yes; Nura only calls after they do, only in their daytime, and they can say \"stop\" on any call. You get a short summary of each call, which can make the next family conversation easier because it's based on how things have actually been going.",
    faqs: [
      {
        q: "What if my parent refuses help?",
        a: "If they can make the decision, respect it, keep talking, and make sure they know how to get help in an emergency. A council needs assessment can sometimes be easier to accept as \"just finding out\".",
      },
      {
        q: "Who can help with the conversation?",
        a: "A trusted friend, their GP, or an advocate. The NHS notes advocates can speak up for someone and are often free.",
      },
    ],
    sources: [SRC.needsAssessment, SRC.advocate, SRC.alarms],
    related: [
      "can-my-elderly-parent-live-alone",
      "how-to-share-the-care-of-a-parent-with-siblings",
      "worried-about-elderly-parent-living-alone",
      "how-to-get-help-at-home-for-an-elderly-parent",
    ],
    media: media(
      IMG.howTheyAgree,
      "With Nura, your parent decides: they get a link and calls only start once they say yes.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "what-to-do-if-an-elderly-parent-falls",
    category: "elderly",
    question: "What to do if an elderly parent falls",
    title: "What to do if an elderly parent falls",
    description:
      "What the NHS says to do straight after a fall, when to call 999 or 111, and how to lower the chance of another one.",
    answer:
      "Stay calm and check for injuries. Call 999 if they may have hurt their head, back, neck or hip, or can't get up. If they can get up, the NHS suggests rolling onto their side, getting onto hands and knees, and using something stable to stand slowly. After any fall, they should see a GP, who can check balance and may refer them to a falls service.",
    why:
      "A fall is frightening for everyone, and many older people hide falls because they worry it means losing independence. But one fall often means there's a reason worth finding, and the NHS says making changes to prevent falls helps people keep their confidence and independence. If you live far away, you may only hear about it days later.",
    sections: [
      {
        heading: "When should you call 999 or 111?",
        paras: [
          "The NHS says call 999 if someone has fallen and may have injured their head, back, neck or hip, or cannot get up. If someone else has fallen, keep them comfortable and warm, help them get up carefully if they can, and don't try to lift them yourself. Use NHS 111 if they've fallen and may be in pain, injured or unwell.",
        ],
      },
      {
        heading: "How can you help prevent another fall?",
        paras: ["The NHS suggests:"],
        list: [
          "Staying active, including strength and balance activities at least twice a week.",
          "Well-fitting shoes or slippers with a good grip.",
          "Wearing a personal alarm or carrying a mobile phone.",
          "A non-slip mat in the bath or shower, and grab rails or safety rails where needed.",
          "Less clutter and fewer trip hazards, such as loose wires or rugs.",
          "Eating well and staying hydrated.",
          "Regular eye and hearing checks.",
          "Asking a GP or pharmacist whether medicines could be affecting balance.",
        ],
      },
    ],
    steps: [
      {
        title: "Check before moving",
        body: "Take a couple of minutes. If there's pain in the head, back, neck or hip, or they can't get up, call 999.",
      },
      {
        title: "Get up slowly, if safe",
        body: "Roll onto the side, then onto hands and knees, crawl to something stable, put one foot flat and stand slowly, then sit and rest.",
      },
      {
        title: "If they can't get up",
        body: "Use a phone or alarm, keep warm with whatever's in reach, and keep moving gently while waiting for help.",
      },
      {
        title: "Book a GP appointment",
        body: "The NHS says see a GP after a fall. In some areas people can refer themselves to a falls service.",
      },
      {
        title: "Make the home safer",
        body: "Walk round together and fix trip hazards, lighting and bathroom grip.",
      },
      {
        title: "Plan for next time",
        body: "A personal alarm, a key safe and a named person to call mean help arrives faster.",
      },
    ],
    avoid: [
      "Lifting someone who's fallen on your own.",
      "Treating a fall as nothing because they seem fine.",
      "Relying on a scheduled phone call to catch a fall.",
    ],
    nura:
      "Nura isn't an alarm and can't detect or respond to a fall; for that, the NHS describes personal alarms and fall detectors. Where Nura helps is afterwards and in between: with your parent's agreement, it gives them a short call in their daytime and tells you how it went, so you hear about wobbles, a bruise or \"a bit of a slip\" sooner, and can keep the follow-up (a GP visit, a grab rail) on a Care plan the family shares.",
    faqs: [
      {
        q: "Should an elderly person see a doctor after a fall?",
        a: "The NHS says see a GP if you've had a fall or are worried about balance or mobility. Call 999 for a suspected head, back, neck or hip injury, or if they can't get up.",
      },
      {
        q: "Do falls mean my parent can't live alone?",
        a: "Not necessarily. A falls assessment, home changes, strength and balance exercise and an alarm help many people stay at home.",
      },
    ],
    sources: [SRC.falls, SRC.alarms, SRC.olderActivity, SRC.nhs999],
    related: [
      "how-to-monitor-elderly-parent-at-home",
      "can-my-elderly-parent-live-alone",
      "checking-on-a-parent-after-a-hospital-stay",
      "worried-about-elderly-parent-living-alone",
    ],
    media: media(
      IMG.checksInWithMargaret,
      "Nura's regular calls to someone you care for are for staying in touch between visits. They aren't an alarm.",
    ),
    teaser: teaser(
      IMG.whoIsThisFor,
      "Hear how they're doing between visits",
      "Add your parent to a Care plan with their first name and number. Once they agree, Nura gives them a short call in their daytime and tells you how it went.",
      "Start a Care plan free",
      "care_for_someone",
    ),
  },
];
