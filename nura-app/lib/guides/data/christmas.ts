import { SRC } from "../sources";
import type { Guide } from "../types";
import { CARE_FOR_TEASER, CHECK_IN_TEASER, IMG, TRY_LINK, media } from "./media";

/**
 * Christmas and new-year guides (written 19 Nov 2026). The visit, the weeks after it, being
 * on your own over Christmas, and sharing the calls between brothers and sisters.
 * Companion framing only: Nura keeps in touch, it doesn't assess, detect or keep anyone safe.
 * Health worries are signposted to the person's GP, NHS 111 and Samaritans (116 123), all
 * checked on nhs.uk on 19 Nov 2026.
 */
const PLUS_LINE =
  "Nura Plus is US$9.99 a month after a 14-day free trial (prices may vary by region); you add a card to start the trial and can cancel before it ends.";

export const CHRISTMAS_GUIDES: Guide[] = [
  {
    slug: "what-to-notice-visiting-elderly-parent-at-christmas",
    category: "elderly",
    question: "What to notice when you visit an elderly parent at Christmas (and what to do in January)",
    title: "Christmas visit to an elderly parent: what to notice",
    description:
      "Five small things worth noticing on a Christmas visit to an older parent, how to bring them up kindly, and how to keep in touch once you're home in January.",
    answer:
      "Notice the ordinary things: the post, the fridge, how they move around the house, who they've spoken to this week and how they sound when the house is quiet. Don't turn Christmas into an inspection. Pick one thing to talk about before you leave, agree how you'll keep in touch, and put a date in January to look at it again together.",
    why:
      "Christmas is often the only time of year you see your parent's everyday life for more than an afternoon, so small changes show up that a weekly phone call hides. It's also a bad moment for a big conversation: the house is full, everyone is tired, and nobody wants a row over the washing-up. Then everyone drives home, January is dark and quiet, and what you noticed fades without anything changing.",
    sections: [
      {
        heading: "Five things worth noticing while you're there",
        paras: [
          "None of these proves anything on its own. A pattern, or a change since your last visit, is simply a reason for a kind conversation.",
        ],
        list: [
          "The post. Unopened letters, bills or reminders piling up can mean paperwork has become a chore.",
          "The fridge and cupboards. Is there food they'd actually eat this week, and is it in date? The NHS lists unintentional weight loss and a lack of interest in eating and drinking among common signs of malnutrition, and says people aged 65 and over are particularly at risk.",
          "How they move about the house. Stairs taken slowly, holding on to furniture, a room they've stopped using.",
          "Who they've spoken to this week. Ask about friends, neighbours and groups by name. The NHS says older people are particularly at risk of loneliness if they live alone or don't have regular contact with others.",
          "How they sound when it's just the two of you. Brighter than on the phone, or flatter? Tired, or simply happy to have you there?",
        ],
      },
      {
        heading: "How to bring it up without spoiling the visit",
        paras: [
          "Choose a quiet moment, one to one, not the dinner table. Say what you noticed and how you feel, not a verdict: \"I saw the post has built up, can I help you go through it?\" lands better than \"You're not coping.\"",
          "Ask what they find harder than last year and what would make the winter easier. It's their home and their choice, and people say yes more readily to something they've picked themselves.",
        ],
      },
      {
        heading: "What to do in January",
        paras: [
          "The visit ends but the noticing shouldn't. Set a regular time to be in touch, share what you saw with your brothers and sisters so one person isn't carrying it, and book the next visit before the decorations come down, so there's something in the diary to look forward to.",
          "If something you noticed worries you about their health, encourage them to speak to their GP, or call NHS 111 if it can't wait. In an emergency, call 999. If they seem to be struggling to cope, or tell you they are, Samaritans are there to listen on 116 123.",
        ],
      },
    ],
    steps: [
      {
        title: "Notice quietly for a day or two",
        body: "Help with ordinary jobs, such as making tea, putting the shopping away or fetching the post. You'll see far more than by asking \"are you managing?\"",
      },
      {
        title: "Write down what you saw",
        body: "A few lines on your phone, with what was fine as well as what wasn't. In February you won't remember whether the fridge was nearly empty or you just arrived before the big shop.",
      },
      {
        title: "Pick one thing to talk about",
        body: "One small change is easier to agree to than a list. A weekly shopping delivery, help with the post, or a regular call.",
      },
      {
        title: "Agree how you'll keep in touch",
        body: "Decide the days and time together while you're in the same room. A call they expect feels like company; a surprise call can feel like checking up.",
      },
      {
        title: "Tell your brothers and sisters",
        body: "Share what you noticed and what you agreed, in one message everyone can see, and split who rings when.",
      },
      {
        title: "Put a January date in the diary",
        body: "A call or visit two or three weeks into the new year, to ask how the change is going and whether anything else would help.",
      },
    ],
    avoid: [
      "Raising it in front of the whole family on Christmas Day.",
      "Leaving with a long list of things for them to fix alone.",
      "Tidying, sorting and rearranging their home without asking.",
      "Promising to ring every day and stopping by the second week of January.",
    ],
    nura:
      "Nura can keep some of the contact going after you've gone home. While you're together, you start a Care plan about your parent with their first name and number, and they agree by tapping Yes on a link (or you confirm they're happy to be called). Nura then gives them a short call on their ordinary phone, only between 9am and 8pm their time, asks how things are going, and sends you a short summary of each call. They can say \"stop\" on any call. Nura is a companion that keeps in touch; it isn't an alarm or an emergency service and it doesn't judge anyone's health. Calls to someone you care for are part of Nura Plus. " +
      PLUS_LINE,
    faqs: [
      {
        q: "What are the signs an elderly parent needs more help at home?",
        a: "There's no single sign. Families often notice post piling up, less food in the house, moving around more carefully, seeing fewer people, or sounding flat. A change since your last visit matters more than any one thing, and it's a reason to talk, not to decide for them.",
      },
      {
        q: "Should I say something at Christmas or wait until afterwards?",
        a: "A short, kind, one-to-one chat before you leave usually works better than a phone call weeks later, because you can agree a next step together. Keep the bigger conversations for a calmer day.",
      },
      {
        q: "Who can I ask about extra help for my parent?",
        a: "In the UK, anyone can ask their local council's adult social services for a free care needs assessment. If your worry is about their health, their GP is the place to start, or NHS 111 if it can't wait.",
      },
    ],
    sources: [SRC.malnutrition, SRC.lonely, SRC.needsAssessment, SRC.nhs111, SRC.urgentMentalHealth],
    related: [
      "worried-about-elderly-parent-living-alone",
      "how-to-talk-to-a-parent-about-needing-more-help",
      "stay-in-touch-with-parent-who-lives-alone-after-christmas",
      "share-check-in-calls-for-a-parent-between-siblings",
    ],
    media: media(
      IMG.howTheyAgree,
      "Setting up calls in Nura for a parent called Margaret. It's easiest while you're in the same room: she says yes on a link, and Nura only calls in her daytime.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "stay-in-touch-with-parent-who-lives-alone-after-christmas",
    category: "elderly",
    question: "How to stay in touch with a parent who lives alone after Christmas",
    title: "Staying in touch with a parent after Christmas",
    description:
      "January is quiet for a parent who lives alone. A simple rhythm of calls, messages and visits that lasts past the first week, shared with the family.",
    answer:
      "Agree a rhythm before you leave: fixed days and a time for calls, a small daily touchpoint such as a photo or a message, and the next visit already in the diary. Share the calls with brothers, sisters and grandchildren so it doesn't rest on one person, and keep each call about them and their day, not a list of questions.",
    why:
      "The house goes from full to silent in a day. Cards come down, the weather is poor, clubs and groups often pause until mid-January, and your own life fills up again with work and school. Good intentions made on Boxing Day rarely survive without a plan. The NHS says older people are particularly at risk of loneliness if they live alone or don't have regular contact with others, and the weeks after Christmas are when regular contact is easiest to let slip.",
    sections: [
      {
        heading: "A simple rhythm for January",
        paras: ["Change the days to suit your family. What matters is that your parent knows when to expect you."],
        list: [
          "Two fixed calls a week, same days, same time. Short is fine.",
          "One small thing most days: a photo, a voice message, a question about the crossword or the football.",
          "A longer catch-up at the weekend, on video if they like it.",
          "A different family member each week for an extra call, so they hear more than one voice.",
          "The next visit, or their visit to you, written on their calendar.",
        ],
      },
      {
        heading: "What to talk about so it doesn't feel like checking up",
        paras: [
          "Ask about something specific from last time: the neighbour's dog, the programme they were watching, what they cooked. Tell them something small about your own day, so the call goes both ways.",
          "The NHS suggests older people who feel lonely keep in touch by phone or video call, join local groups or classes, invite someone round even for a short visit, and plan things to look forward to. You can help with each of those from a distance: look up when their group starts again, or plan something for February together.",
        ],
      },
      {
        heading: "If they seem low",
        paras: [
          "A flat week in January is common. The NHS suggests seeing a GP if someone is struggling to cope with low mood, or has had a low mood for more than 2 weeks. If they need help urgently and it isn't an emergency, call NHS 111. For someone who is struggling and wants to talk, Samaritans are on 116 123. In an emergency, call 999.",
        ],
      },
    ],
    steps: [
      {
        title: "Agree the rhythm before you leave",
        body: "Ask what they'd like: mornings or evenings, calls or messages, how often. Write the days on their calendar as well as yours.",
      },
      {
        title: "Put it in your own diary as a repeat",
        body: "A repeating reminder on your phone turns a promise into a habit. Treat it like any other appointment.",
      },
      {
        title: "Share it out",
        body: "Give brothers, sisters and older grandchildren a day each. Three people ringing once a week is steadier than one person trying to ring daily.",
      },
      {
        title: "Add a small daily touchpoint",
        body: "A photo of the dog, the view from the train, what's for tea. It takes seconds and tells them they're in your day.",
      },
      {
        title: "Plan one thing to look forward to",
        body: "A visit, a lunch out, a trip to see the grandchildren in a play. Having a date matters more than how big it is.",
      },
      {
        title: "Review it at the end of January",
        body: "Ask what they've liked and what felt like too much. Adjust rather than quietly dropping it.",
      },
    ],
    avoid: [
      "Promising a daily call you can't keep. Fewer calls that always happen are better.",
      "Calling only when you're worried, so every call starts with \"is everything all right?\"",
      "Relying on a family group chat your parent doesn't read.",
      "Leaving it all to whoever lives nearest.",
    ],
    nura:
      "Nura can be one of the regular calls. You start a Care plan about your parent with their first name and number; once they tap Yes on a link you send (or you confirm they've agreed), Nura gives them a short, friendly call on their ordinary phone, only between 9am and 8pm their time, and asks how things are going. You get a short summary of each call, so you know what to pick up on when you ring. You can invite brothers and sisters to the same Care plan. Your parent doesn't need an app or a smartphone and can say \"stop\" on any call. Nura adds to the family's calls and doesn't replace them, and it isn't an alarm or an emergency service. Calls to someone you care for are part of Nura Plus. " +
      PLUS_LINE,
    faqs: [
      {
        q: "How often should I call a parent who lives alone?",
        a: "Agree it with them. A rhythm they can count on, even two short calls a week at the same time, usually helps more than long calls now and then.",
      },
      {
        q: "What if my parent says they're fine and doesn't want a fuss?",
        a: "Take them at their word and keep it light. Frame calls as something you enjoy, not something they need, and let them choose the days.",
      },
      {
        q: "What if they don't answer when I call?",
        a: "Agree in advance what happens: you try again in an hour, then ring a neighbour or friend who has agreed to knock. If you think they may be in danger, call 999.",
      },
    ],
    sources: [SRC.lonely, SRC.nhs111, SRC.urgentMentalHealth],
    related: [
      "daily-check-in-calls-for-elderly-parents",
      "how-to-help-a-lonely-elderly-parent",
      "caring-for-a-parent-from-a-distance",
      "what-to-notice-visiting-elderly-parent-at-christmas",
    ],
    media: media(
      IMG.checksInWithMargaret,
      "A Care plan in Nura for a parent called Margaret: a call in her daytime, a note to you on how it went, and she can say stop on any call.",
    ),
    teaser: CARE_FOR_TEASER,
  },
  {
    slug: "spending-christmas-alone",
    category: "routines",
    question: "Spending Christmas alone: small ways to feel less lonely",
    title: "Spending Christmas alone: ways to feel less lonely",
    description:
      "Small, practical ways to make Christmas on your own feel less lonely: a loose plan for the day, one bit of contact, getting outside, and who to call.",
    answer:
      "Give the day a loose shape so it doesn't stretch out empty: one thing to get you outside, one bit of contact with another person, one thing you enjoy, and a meal you'd actually like. Go easy on comparing your day with everyone else's. If the day feels too heavy, you can talk to Samaritans on 116 123.",
    why:
      "Loneliness is sharper at Christmas because the whole world seems to be telling you who you should be with. Shops shut, routines stop, friends vanish into family plans, and social media fills with other people's best moments. Plenty of people are on their own that day, by choice or not: after a bereavement or a break-up, working shifts, living far from family, or simply without anyone close by. Feeling lonely then isn't a failing, and it doesn't mean something is wrong with you.",
    sections: [
      {
        heading: "What the NHS suggests when you feel lonely",
        paras: ["The NHS has a short list of things to try. The ones that fit Christmas Day best:"],
        list: [
          "Talk about how you feel to a friend, a family member or someone else you trust.",
          "Spend some time where other people are around, such as a park or a café. On Christmas morning, a walk where others are walking counts.",
          "Do something you enjoy, such as a walk, some exercise or a podcast.",
          "Set small, achievable goals. Don't try to do everything at once.",
          "Try not to compare yourself with others on social media, where people mostly share their best moments.",
          "Remember that many people feel lonely at some point. You aren't the only one.",
          "Go easy on alcohol. The NHS says using alcohol to ease loneliness can make your mental health worse.",
        ],
      },
      {
        heading: "If the day gets too heavy",
        paras: [
          "You don't have to wait until things are at their worst to talk to someone. Samaritans are there to listen on 116 123. If you need help urgently and it isn't an emergency, call NHS 111 or use 111 online. If your life is at risk, or you can't keep yourself safe, call 999.",
          "If you've felt low for more than 2 weeks, or what you're trying isn't helping, the NHS suggests seeing a GP once surgeries reopen.",
        ],
      },
    ],
    steps: [
      {
        title: "Decide the shape of the day beforehand",
        body: "Three or four anchors are enough: a walk at 10, a call at 12, a film at 3, a proper meal. An empty day feels longer than a planned one.",
      },
      {
        title: "Arrange one bit of contact in advance",
        body: "Ask a friend or relative for ten minutes on the phone at a set time, or send a few messages in the morning. People are usually glad to be asked.",
      },
      {
        title: "Get outside in daylight",
        body: "Even a short walk changes the day. Christmas morning is one of the few times strangers say hello to each other.",
      },
      {
        title: "Make food you'd actually enjoy",
        body: "It doesn't have to be a roast. Buy it ahead, because most shops are shut on the day.",
      },
      {
        title: "Look for somewhere to be, if you'd like company",
        body: "Many communities run a Christmas Day lunch or a drop-in, and some charities need volunteers. Look locally a week or two ahead, as places and rotas fill up.",
      },
      {
        title: "Plan something for the days after",
        body: "The stretch between Christmas and New Year can be as quiet as the day itself. Put one thing in each day, however small.",
      },
    ],
    avoid: [
      "Scrolling through other people's Christmas all day.",
      "Leaving the day completely unplanned and hoping it passes.",
      "Drinking to get through it.",
      "Telling yourself everyone else is having a perfect day. They aren't.",
    ],
    nura:
      "Nura is a wellbeing companion that checks in on you. Tell it, in your own words, that you're on your own this Christmas and what you'd like the day to look like, and it keeps a simple Care plan and checks in at the times you choose, in the app, on WhatsApp or with a short call, including on Christmas Day. It remembers what you told it, so the check-in is about your plan, not a generic message. Nura is an AI companion, not a person, a counsellor or a crisis line, and it doesn't replace the people in your life. You can try the planner on Nura's home page with no account and no card. Using Nura needs a Nura Plus plan. " +
      PLUS_LINE,
    faqs: [
      {
        q: "Is it normal to feel lonely at Christmas?",
        a: "Yes. The NHS says many people feel lonely at some point in their lives, and Christmas makes it more noticeable because routines stop and the day is so focused on being together.",
      },
      {
        q: "Who can I talk to on Christmas Day?",
        a: "Samaritans are on 116 123. For urgent help that isn't an emergency, call NHS 111 or use 111 online. In an emergency, call 999.",
      },
      {
        q: "What can I do on Christmas Day by myself?",
        a: "Give it a loose plan: a walk in daylight, one call or message with someone, something you enjoy, and food you like. Some people volunteer or go to a community lunch, which are best arranged a week or two ahead.",
      },
      {
        q: "How can I help someone who is alone at Christmas?",
        a: "Ask them directly and early: a place at your table, a walk on the day, or a call at a set time. A specific offer is easier to accept than \"let me know if you need anything\".",
      },
    ],
    sources: [SRC.lonely, SRC.urgentMentalHealth, SRC.nhs111, SRC.fiveSteps],
    related: [
      "daily-wellbeing-check-in",
      "wellbeing-check-in-questions",
      "how-to-help-a-lonely-elderly-parent",
      "stay-in-touch-with-parent-who-lives-alone-after-christmas",
    ],
    media: media(
      IMG.channels,
      "Nura's setup screen for how check-ins reach you: in the app, on WhatsApp, or as a short phone call.",
      TRY_LINK,
    ),
    teaser: CHECK_IN_TEASER,
  },
  {
    slug: "share-check-in-calls-for-a-parent-between-siblings",
    category: "caring",
    question: "How to share check-in calls for a parent between brothers and sisters",
    title: "Sharing check-in calls for a parent with siblings",
    description:
      "A fair way for brothers and sisters to share calls to a parent: a simple rota, one place for notes, cover for holidays, and a review before anyone resents it.",
    answer:
      "Agree a simple rota with a named person for each day or week, keep one shared place where everyone writes a line after their call, decide what happens when someone can't make it, and review the split after a month. Ask your parent first how often they'd like to be rung and by whom. It's their phone that's ringing.",
    why:
      "Calls usually fall to one person: the eldest, the daughter, or whoever lives nearest. Everyone else assumes it's covered. The one doing the ringing gets tired and quietly resentful, the others feel shut out or guilty, and your parent either gets three calls on Sunday and none until Thursday, or tells each of you a slightly different version of how they are. Christmas, when you're all in one place, is the easiest time of year to sort it out.",
    sections: [
      {
        heading: "A sample rota for three siblings",
        paras: ["An example to adapt, not a rule. Fewer calls that always happen are better than a full week that collapses by February."],
        list: [
          "Monday evening: the eldest rings.",
          "Wednesday lunchtime: the second rings.",
          "Friday evening: the third rings.",
          "Sunday: whoever is free does a longer video call, with grandchildren if they're about.",
          "Holidays and illness: swap in the shared chat at least a day ahead, so the call still happens.",
        ],
      },
      {
        heading: "What to write down after each call",
        paras: [
          "Two lines is plenty: how they sounded, and anything to follow up (a delivery that didn't come, a neighbour who's away, a date to remember). Put it where everyone can see it. The point is that the next person to ring can pick up where you left off, and nobody has to ask your parent the same questions three times.",
          "If a call leaves you worried about their health, encourage them to speak to their GP, or call NHS 111 if it can't wait, and tell the others what you did. In an emergency, call 999.",
        ],
      },
    ],
    steps: [
      {
        title: "Ask your parent what they'd like",
        body: "How often, what time of day, and whether they'd rather have calls, messages or a mix. Some people love a daily ring; others find it too much.",
      },
      {
        title: "Give every slot a name",
        body: "\"We'll all ring more\" doesn't work. \"You have Mondays, I have Wednesdays\" does.",
      },
      {
        title: "Split by what's realistic",
        body: "Shift work, small children and time zones differ. The sibling abroad might take the weekend video call; the one nearby might swap a call for a visit.",
      },
      {
        title: "Keep one place for notes",
        body: "One shared note, chat or plan, not three separate threads. Agree that updates go there and nowhere else.",
      },
      {
        title: "Agree what to do about a missed call",
        body: "Decide who tries again, when, and who can knock on the door if nobody gets an answer. Sort this out before it happens.",
      },
      {
        title: "Review after a month",
        body: "Ask your parent how it feels and ask each other whether the split is fair. Change it before anyone reaches breaking point.",
      },
    ],
    avoid: [
      "Assuming the sibling who lives nearest will do all the ringing.",
      "Keeping score of who has called most.",
      "Everyone calling on the same day and nobody midweek.",
      "Talking about your parent in a group they can't see, and never with them.",
    ],
    nura:
      "Nura can take one or more of the slots and keep everyone on the same page. One of you starts a Care plan about your parent, and once your parent agrees, Nura gives them a short call in their daytime (only between 9am and 8pm their time) and writes a short summary. You invite your brothers and sisters to that Care plan, so everyone sees the same plan, its next steps and whether check-ins are done, and Nura writes them a short update from it. You can switch on an alert that tells the people you've invited when a scheduled check-in still isn't done a day later. People you invite never see your private conversation with Nura, and your parent can say \"stop\" on any call. Calls to someone you care for are part of Nura Plus. " +
      PLUS_LINE,
    faqs: [
      {
        q: "How do we split calls fairly when we live in different places?",
        a: "Split by what each person can do, not into equal numbers. Someone far away can take a regular video call or the paperwork; someone close can visit. What matters is that every slot has a name against it.",
      },
      {
        q: "What if one sibling won't take a turn?",
        a: "Ask for something specific and small, such as one call a fortnight, rather than \"more help\". If they still won't, plan around the people who will, and look at other support so the gap isn't filled by one exhausted person.",
      },
      {
        q: "How many calls a week does a parent need?",
        a: "There's no set number. Ask them. Two or three calls they can count on, spread through the week, suit many families better than a daily call that keeps being missed.",
      },
    ],
    sources: [SRC.lonely, SRC.carerAssessment, SRC.nhs111],
    related: [
      "how-to-share-the-care-of-a-parent-with-siblings",
      "how-to-share-health-updates-with-family",
      "daily-check-in-calls-for-elderly-parents",
      "what-to-notice-visiting-elderly-parent-at-christmas",
    ],
    media: media(
      IMG.whoIsThisFor,
      "Starting a Care plan in Nura for someone you care for: their first name, relationship and number. Brothers and sisters can then be invited to the same plan.",
    ),
    teaser: CARE_FOR_TEASER,
  },
];
