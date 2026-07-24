# AI Layer

Anthropic prompting, structured extraction, and response-shaping helpers live here.

Near-term modules:

- `classify-source-context.ts`
- `extract-care-note.ts`
- `propose-living-plan.ts`
- `generate-check-in.ts`
- `summarize-plan-for-appointment.ts`

All AI outputs should be validated through `lib/schemas` before they reach UI or persistence.
