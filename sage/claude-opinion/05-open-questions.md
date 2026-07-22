# Open Questions

Decisions I can make a case for, but shouldn't make unilaterally. Answer these before (or right at the start of) scaffolding.

## 1. Where does the codebase live?

I've proposed `sage/app/` as a new sibling to the existing doc folders (see [02-architecture.md](02-architecture.md)). Alternative: codebase at the repo root, docs stay under `sage/`. I'd avoid the repo root option — it mixes `clariti/`'s presence at the root with Sage's code, which cuts against the folder-sovereignty instruction already in place.

**My lean:** `sage/app/`.

## 2. Team size and parallelization

The build plan in [04-build-plan.md](04-build-plan.md) assumes 2–4 people working phases in parallel from Phase 2 onward. If it's a solo build, the timeline roughly doubles and Phase 2/3 need to happen serially — worth deciding now so the cut list isn't a surprise at 1 AM.

## 3. Real WhatsApp/Twilio as a stretch goal, or explicitly out of scope?

[01-tech-stack.md](01-tech-stack.md) recommends simulator-only for the demo. If you want to attempt a real Twilio WhatsApp Sandbox integration as a stretch goal, it should be scoped as strictly additive — built only after the simulator-based loop is fully working — so a failed integration attempt never blocks the core demo.

## 4. Auth: seeded demo user, or real Supabase Auth?

Affects whether RLS policies matter for the demo (see [03-data-model.md](03-data-model.md)). A real auth flow is a believable "this is a product, not a prototype" signal but costs build time that could go toward the core loop instead.

**My lean:** seeded demo user for speed, with RLS policies still written (cheap to add, signals privacy-mindedness for a health product) but not enforced as a login gate during the demo.

## 5. Model choice: Sonnet vs Opus for generation calls

Sonnet should be the default per [01-tech-stack.md](01-tech-stack.md). Worth a quick side-by-side test during Phase 1 on the actual "Stabilise My Week" demo prompt — if Sonnet's plan/check-in output already reads as calm, specific, and on-brief, there's no reason to pay Opus latency/cost during a live demo.

## 6. What happens to `sage/ui:ux/old/`?

Nineteen images sit in `old/` alongside sixteen in `main + use this ui/`. If `old/` is fully superseded, I'd suggest removing it before the build starts so nobody accidentally builds off stale references — but that's a deletion, so it's your call, not mine to make silently.
