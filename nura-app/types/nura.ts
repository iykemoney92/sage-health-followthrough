export type NuraSourceKind =
  | "conversation"
  | "clinician_note"
  | "medication_instruction"
  | "therapy_note"
  | "occupational_health"
  | "user_goal"
  | "document_upload";

export type NuraPlanStatus = "draft" | "active" | "paused" | "completed" | "needs_review";

export type NuraPlanCategory =
  | "gp_follow_up"
  | "medication_follow_through"
  | "symptom_monitoring"
  | "mental_wellbeing"
  | "sleep_energy"
  | "recovery_aftercare"
  | "postpartum_aftercare"
  | "occupational_stress"
  | "therapy_follow_through"
  | "caregiver_support"
  | "general_health";

export type NuraCheckInChannel = "whatsapp" | "in_app" | "voice";

export interface NuraSourceContext {
  id: string;
  planId: string;
  kind: NuraSourceKind;
  title: string;
  summary: string;
  isClinicianProvided: boolean;
  requiresUserConfirmation: boolean;
  createdAt: string;
}

export interface NuraPlan {
  id: string;
  ownerId: string;
  title: string;
  category: NuraPlanCategory;
  status: NuraPlanStatus;
  whyThisExists: string;
  currentFocus: string;
  nextStep: string;
  createdAt: string;
  updatedAt: string;
}

export interface NuraCheckIn {
  id: string;
  planId: string;
  channel: NuraCheckInChannel;
  prompt: string;
  scheduledFor: string;
  completedAt?: string;
}

export interface NuraObservation {
  id: string;
  planId: string;
  sourceContextId?: string;
  label: string;
  value: string;
  recordedAt: string;
}
