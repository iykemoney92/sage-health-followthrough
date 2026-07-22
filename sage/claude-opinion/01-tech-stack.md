# Tech Stack Recommendation

The project summary already names a stack. This is my take on locking it in, with the specific tradeoffs a 26-hour hackathon window forces.

## Recommended stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14+ (App Router) + TypeScript | Server actions/route handlers give you a backend without standing up a separate API service |
| Styling | Tailwind CSS + shadcn/ui | Fast to theme to the sage-green/off-white palette; avoids hand-building basic components (cards, dialogs, tabs) under time pressure |
| DB / Auth / Storage | Supabase (Postgres + Auth + Storage) | Matches the brief; one dashboard for schema, auth, and file uploads |
| AI | Anthropic Claude, Messages API | Claude Sonnet as the default model (fast, cheap, plenty capable for structuring/summarizing text). Only reach for Opus if a specific generation step is visibly weak in testing |
| Voice | ElevenLabs — **TTS only** | Generate audio for the check-in script and play it back. No speech-to-text loop in the MVP — see reasoning below |
| WhatsApp | In-app WhatsApp-style simulator (styled chat UI, not the real API) | See reasoning below |
| Hosting | Vercel | Matches the brief; trivial deploy from the Next.js repo, preview URLs for judging |

## Reasoning on the two contentious calls

### WhatsApp: simulate it, don't integrate it

The real WhatsApp Business API (via Twilio or Meta directly) needs business verification, template message approval, or — at best — a sandbox join flow that requires the judge or demo audience to text a join code before they see anything. That's a fragile live-demo dependency for a 90-second judging window, and none of it demonstrates product thinking that a well-built simulator can't also show.

Build a chat UI styled like WhatsApp (bubbles, timestamps, quick-reply buttons) living inside the web app. It proves the *interaction model* — proactive check-in, quick replies, conversational tone — without betting the demo on carrier/webhook reliability. If there's time left after the core loop works, a Twilio WhatsApp Sandbox integration is a legitimate stretch goal, not a foundation.

### Voice: text-to-speech only, skip the conversation loop

Full voice check-ins (speech-to-text → Claude → text-to-speech, with turn-taking) is a real engineering project on its own. For the MVP, "voice check-in" should mean: Claude generates the check-in script, ElevenLabs renders it as audio, the user hears it and responds via the same quick-reply/text UI as the text channel. That's enough to demonstrate "Sage can speak to you" without building a live voice agent under time pressure.

### Auth: keep it minimal

Supabase Auth is fine, but don't spend hackathon hours on a full sign-up/login flow, email verification, password reset, etc. A single seeded demo user (or magic-link with no confirmation friction) is enough — see [05-open-questions.md](05-open-questions.md) for the decision this implies for Row Level Security.

## What I'd explicitly avoid

- A separate backend service (FastAPI, Express, etc.) — Next.js route handlers are sufficient and halve the deployment surface
- A queue/scheduler (cron, BullMQ) for check-ins — the demo can trigger the "next check-in" on a button press instead of real-time scheduling; see [04-build-plan.md](04-build-plan.md)
- Any wearable, EHR, or NHS integration — explicitly out of scope in the brief, and a time sink if touched even superficially
