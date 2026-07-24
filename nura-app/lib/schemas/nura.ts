import { z } from "zod";

export const sourceKindSchema = z.enum([
  "conversation",
  "clinician_note",
  "medication_instruction",
  "therapy_note",
  "occupational_health",
  "user_goal",
  "document_upload",
]);

export const planCategorySchema = z.enum([
  "gp_follow_up",
  "medication_follow_through",
  "symptom_monitoring",
  "mental_wellbeing",
  "sleep_energy",
  "recovery_aftercare",
  "therapy_follow_through",
  "caregiver_support",
  "general_health",
]);

export const createPlanSchema = z.object({
  title: z.string().min(1),
  category: planCategorySchema.default("general_health"),
  whyThisExists: z.string().min(1),
  currentFocus: z.string().min(1),
  nextStep: z.string().min(1),
  sourceContextIds: z.array(z.string()).default([]),
});

export const sourceContextSchema = z.object({
  kind: sourceKindSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  isClinicianProvided: z.boolean().default(false),
  requiresUserConfirmation: z.boolean().default(false),
});

export const scheduleCheckInSchema = z.object({
  planId: z.string().min(1),
  channel: z.enum(["in_app", "whatsapp", "voice"]).default("in_app"),
  prompt: z.string().min(1),
  scheduledFor: z.string().datetime(),
});
