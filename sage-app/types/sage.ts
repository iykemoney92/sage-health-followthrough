export type PlanType = "wellbeing" | "health_follow_up" | "mixed";
export type PlanStatus = "draft" | "active" | "paused" | "completed" | "archived";
export type SessionStatus = "upcoming" | "today" | "completed" | "skipped" | "rescheduled";
export type CheckinChannel = "whatsapp_text" | "whatsapp_voice" | "web_chat" | "reminder";

export interface Session {
  id: string;
  plan_id: string;
  order_index: number;
  title: string;
  objective: string;
  status: SessionStatus;
  scheduled_at: string | null;
  channel: CheckinChannel;
  prompt_script: string | null;
  expected_inputs: string[];
}

export interface Plan {
  id: string;
  user_id: string;
  title: string;
  type: PlanType;
  goal: string;
  source_summary: string;
  status: PlanStatus;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  check_in_channel: CheckinChannel;
  sessions: Session[];
}

export interface ChatMessage {
  id: string;
  role: "sage" | "user";
  content: string;
  at: string;
}
