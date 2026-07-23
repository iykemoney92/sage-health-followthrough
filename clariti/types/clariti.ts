export type ClaritiDocumentKind =
  | "medical_bill"
  | "insurance_eob"
  | "radiology_report"
  | "medication_context"
  | "unknown";

export type ClaritiSessionStatus = "draft" | "active" | "complete" | "needs_review";

export type ClaritiArtifactKind =
  | "bill_breakdown"
  | "eob_explanation"
  | "radiology_explainer"
  | "glossary"
  | "follow_up_actions";

export interface ClaritiDocument {
  id: string;
  ownerId: string;
  fileName: string;
  kind: ClaritiDocumentKind;
  status: "uploaded" | "classified" | "extracted" | "failed";
  createdAt: string;
}

export interface ClaritiSession {
  id: string;
  ownerId: string;
  title: string;
  status: ClaritiSessionStatus;
  documentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClaritiArtifact {
  id: string;
  sessionId: string;
  kind: ClaritiArtifactKind;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
