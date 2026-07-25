# Clariti UAT Journey

## Primary Journey

1. Visitor lands on `/`.
2. Visitor selects one of the three document lanes: medical bill, insurance EOB, or radiology report.
3. Visitor signs up or signs in when Supabase auth is configured.
4. User pastes document text or uses the safe demo text.
5. User sends the document into `/workspace`.
6. Clariti classifies the lane and calls `/api/analyze`.
7. `/api/analyze` generates an Anthropic-backed structured analysis.
8. When authenticated, the API persists:
   - `clariti_documents`
   - `clariti_sessions`
   - `clariti_session_documents`
   - `clariti_messages`
   - `clariti_artifacts`
9. Workspace renders chat plus the adaptive canvas.
10. Radiology reports render a five-scene source-grounded explainer storyboard.
11. User can prepare Call Clariti context through `/api/voice/report-context`.
12. User can schedule a phone follow-up through `/api/follow-ups`.
13. Documents and History pages read persisted rows through `/api/documents` and `/api/sessions`.

## Acceptance Checks

- Auth pages load at `/login` and `/signup`.
- Protected product routes keep the user on `/`, open the auth modal, and preserve the intended destination in `next`.
- There is no local demo bypass when Supabase is missing; users must sign in or connect Supabase before product routes/actions proceed.
- Analysis never diagnoses, prescribes, or makes final coverage/payment decisions.
- Radiology video scenes are text/storyboard scenes grounded in source anchors, not third-party generated medical imagery.
- Bills and EOBs use cautious language around what the user may owe.
- Follow-ups are tied to one concrete action.
- Supabase RLS is enabled on public Clariti tables.
