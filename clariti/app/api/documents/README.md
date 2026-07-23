# Documents API

Routes in this folder will own document upload, classification, extraction status, and secure retrieval.

MVP endpoints:

- `POST /api/documents` upload document metadata and storage reference
- `GET /api/documents/:id` read document state
- `POST /api/documents/:id/classify` classify the document kind
