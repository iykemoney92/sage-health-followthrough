# Claude's Opinion — Technical Planning

This folder holds my (Claude's) technical recommendations for building Sage, written for the Consumer Health Hackathon (10:00 AM July 25 → 12:30 PM July 26, submissions due). These are opinions, not decisions — everything here is meant to be argued with, not rubber-stamped.

`sage/project-summary/MAIN_PROJECT_SUMMARY.md` remains the source of truth for *what* Sage is. These docs are about *how* to build it in ~26 hours.

## Reading order

1. [01-tech-stack.md](01-tech-stack.md) — what to build with, and why
2. [02-architecture.md](02-architecture.md) — how the pieces fit together, folder structure
3. [03-data-model.md](03-data-model.md) — actual Postgres schema (refined from the draft in the main summary)
4. [04-build-plan.md](04-build-plan.md) — hour-by-hour plan mapped to the real event schedule
5. [05-open-questions.md](05-open-questions.md) — decisions I can't make for you — answer these before scaffolding starts

## My one-line take

The risk to this project isn't the AI plan-generation (that's a well-worn Claude use case) — it's scope creep into real WhatsApp/voice infrastructure that eats the clock. Build the simulator first, make it feel real, and only reach for live WhatsApp/voice if there's slack left.
