import { z } from "zod";

export const documentKindSchema = z.enum([
  "medical_bill",
  "insurance_eob",
  "radiology_report",
  "lab_results",
  "discharge_summary",
  "medication_context",
  "pathology_report",
  "referral_letter",
  "visit_notes",
  "prior_authorization",
  "unknown",
]);

export const createSessionSchema = z.object({
  title: z.string().min(1),
  documentIds: z.array(z.string()).default([]),
});

export const createArtifactSchema = z.object({
  sessionId: z.string().min(1),
  kind: z.enum([
    "bill_breakdown",
    "eob_explanation",
    "radiology_explainer",
    "glossary",
    "follow_up_actions",
  ]),
  title: z.string().min(1),
  summary: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});
