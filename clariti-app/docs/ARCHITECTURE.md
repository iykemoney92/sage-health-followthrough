# Clariti Architecture

Clariti is a consumer health document copilot for explaining confusing healthcare documents and turning them into understandable next steps.

## Product Surface

The UI source of truth is the image set in `../clariti/ui:ux/`. This scaffold intentionally avoids inventing final screen design. It only creates the technical surfaces needed to implement those screens.

Planned user flow:

1. User opens a calm empty state with one central composer.
2. User asks a question or attaches a medical bill, EOB, radiology report, or related document.
3. Clariti classifies and extracts the document.
4. The chat explains the document in plain English.
5. The adaptive canvas renders structured artifacts for the task.
6. The user can save, ask follow-up questions, or create an action such as a dispute letter or clinician question list.

## App Layers

- `app` contains Next.js routes, layouts, and API route handlers.
- `components` contains reusable UI primitives and workspace composition.
- `lib/domain` contains Clariti business rules with no framework or vendor dependencies.
- `lib/schemas` contains Zod contracts shared by APIs, AI outputs, and persistence.
- `lib/ai` contains prompt orchestration and structured AI extraction.
- `lib/integrations` contains Supabase, Anthropic, and document parsing clients.
- `lib/repositories` hides database table details behind typed methods.
- `types` contains shared TypeScript product contracts.
- `supabase/migrations` contains the database schema.

## MVP Technical Loop

For the hackathon, the narrowest impressive loop is:

1. Upload one medical bill or EOB.
2. Store file metadata in Supabase.
3. Extract text using a parsing/OCR path.
4. Ask Anthropic for a validated structured explanation.
5. Persist a session and artifact.
6. Render chat plus adaptive canvas.
7. Generate one follow-up action.

## Safety Boundaries

Clariti should explain and organize user-provided healthcare information. It should not diagnose, replace a clinician, or make final coverage/legal determinations.

Use prominent safety handling for urgent symptoms, potential emergencies, self-harm, and instructions that require a licensed professional.
