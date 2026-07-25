# Integrations

External service adapters live here.

Planned adapters:

- Supabase auth, storage, and database clients
- Anthropic client
- WhatsApp messaging provider for proactive check-ins and user replies
- voice check-in provider
- OCR or document parsing provider

No app route should call vendor SDKs directly once the real implementation begins.

Nura should have a WhatsApp-first follow-through posture: lightweight daily messages, replies that update Threads, and clear opt-in controls.
