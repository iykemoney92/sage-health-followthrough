# ElevenLabs Feasibility Test Results

Date: 2026-07-22

## What was tested

We ran a low-risk dashboard feasibility test for the Sage agent concept inside the logged-in ElevenLabs workspace.

Test scope:

- Created a blank ElevenLabs agent named `Sage Feasibility Test`.
- Configured it as chat-only for the first feasibility pass.
- Added a compact Sage system prompt covering:
  - proactive health and wellbeing follow-through
  - mental wellbeing, chronic routines, medication adherence, GP follow-up, lifestyle, occupational health, and therapy homework
  - no diagnosis, no prescribing, no medication-change advice
  - urgent escalation language for emergency/self-harm/severe symptom cases
  - plan/check-in/GP-ready summary behavior
- Used ElevenLabs Preview with `include_draft=true`.
- Checked the WhatsApp accounts page without starting Meta/WhatsApp authorization.

Agent details visible in dashboard:

- Agent name: `Sage Feasibility Test`
- Agent id: `agent_6501ky5p5s57f0t9pa54r22fh8fs`
- Branch id: `agtbrch_0101ky5p5t42fwq9czcke8yrt0t0`

## Result 1: basic Sage behavior works

Synthetic test message:

> Demo user: I am overwhelmed, barely sleeping, and my GP told me to start walking daily but I keep failing to follow through. Can you help me make a plan?

Observed result:

- The agent responded as Sage.
- It created a named plan: `Stabilise My Week`.
- It produced sections for:
  - Today
  - This week
  - Check-ins
  - What to tell my clinician
- It avoided diagnosis and prescribing.
- It used a calm, supportive tone.

Verdict:

ElevenLabs can handle the core MVP conversation loop for a demo: user shares messy health/life context, Sage turns it into a plan, and Sage can conduct follow-up conversation from the dashboard preview.

## Result 2: medication follow-up needs stricter guardrails

Synthetic follow-up message:

> Yesterday I did not walk and I forgot one medication dose. I feel ashamed and I do not want to update my GP unless this gets worse.

Observed result:

- The agent was empathetic and reduced shame.
- It asked which dose was missed and suggested making remembering easier.
- Weakness: it said there was "no pressure" to update the GP right now.

Why this matters:

That phrasing is too relaxed for a healthcare follow-through product. Sage should not create alarm, but it must be more precise around missed medication:

- do not advise doubling doses
- advise following medication leaflet/clinician instructions
- suggest pharmacist/clinician contact if unsure, side effects occur, missed doses repeat, or symptoms worsen
- log the missed dose as part of the GP-ready progress summary
- ask for the smallest adherence support step, not open-ended medication details unless needed

Verdict:

The model behavior is promising, but Sage needs a stronger medication-adherence policy layer before demoing health-specific follow-up.

## WhatsApp feasibility check

The ElevenLabs WhatsApp dashboard is available at:

`https://elevenlabs.io/app/agents/whatsapp`

Observed state:

- The page is accessible in the current account.
- It shows `No WhatsApp accounts`.
- It exposes `Import account` buttons.
- There is a direct docs link to ElevenLabs WhatsApp documentation.

What was not done:

- We did not click `Import account`.
- We did not authorize Meta/WhatsApp permissions.
- We did not send outbound WhatsApp messages or calls.

Reason:

Importing a WhatsApp account likely starts a Meta authorization flow and grants account permissions. That should be done only with explicit action-time confirmation.

## Product/technical verdict

ElevenLabs-first is viable for the hackathon demo, with a fallback simulator still recommended.

Recommended demo stack:

- ElevenLabs agent for live conversational demo.
- Web app dashboard for plans, calendar, progress, and summaries.
- Supabase for users, plans, check-ins, notes, and conversation events.
- Webhook tools later for `create_plan`, `log_checkin`, `update_plan`, and `generate_gp_summary`.
- WhatsApp integration if Meta import succeeds early enough; otherwise show dashboard preview plus a WhatsApp-style simulator.

## Immediate next engineering tasks

1. Tighten Sage system prompt around missed medication, escalation, and clinician handoff.
2. Add structured webhook tool contracts before building the web app deeply:
   - `create_or_update_plan`
   - `log_checkin`
   - `record_barrier`
   - `generate_progress_summary`
3. Build a local simulator that mirrors WhatsApp message flow so the demo is not blocked by Meta/WhatsApp setup.
4. Only after the simulator works, import the WhatsApp account and connect the test agent.

## Go/no-go decision

Go, but with one caveat.

Go because:

- the agent can be created in the account
- the preview works
- the drafted Sage behavior works for the main "overwhelmed user to follow-through plan" loop
- the WhatsApp integration surface exists in the account

Caveat:

Do not rely solely on real WhatsApp for the hackathon demo until the Meta import/account approval path is completed. Build a WhatsApp-style simulator in parallel.
