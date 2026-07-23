# AI Layer

Anthropic prompting, structured extraction, and response-shaping helpers live here.

Near-term modules:

- `classify-document.ts`
- `extract-bill.ts`
- `explain-eob.ts`
- `explain-radiology-report.ts`
- `generate-follow-up-actions.ts`

All AI outputs should be validated through `lib/schemas` before they reach UI or persistence.
