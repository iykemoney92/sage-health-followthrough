import { PLAN_CATEGORIES, type PlanCategory } from "@/lib/domain/journey-naming";
import { formatKnowledgeForPrompt, loadKnowledgeForCategories } from "@/lib/agent/knowledge";

/** Generation knobs for Anthropic text calls (and future voice LLM overrides). */
export type AgentGenerationParams = {
  model: string;
  maxTokens: number;
  temperature: number;
  /** Anthropic top_k; keep moderate for grounded care conversations. */
  topK: number;
};

export type JourneyPersonaConfig = {
  category: PlanCategory | "default";
  label: string;
  /** Extra role layer on top of NURA_CORE_IDENTITY. */
  roleOverlay: string;
  /** Knowledge doc ids / categories to load. */
  knowledgeCategories: PlanCategory[];
  text: AgentGenerationParams;
  voice: AgentGenerationParams;
  /** Optional override: env var name holding a dedicated ElevenLabs agent id. */
  elevenLabsAgentIdEnv?: string;
};

const DEFAULT_TEXT: AgentGenerationParams = {
  model: "claude-sonnet-5",
  maxTokens: 1024,
  temperature: 0.7,
  topK: 45,
};

const DEFAULT_VOICE_TEXT: AgentGenerationParams = {
  model: "claude-sonnet-5",
  maxTokens: 400,
  temperature: 0.45,
  topK: 30,
};

/** Reasoning-heavier care modes (postpartum midwife-like, mental health). */
const DEEP_TEXT: AgentGenerationParams = {
  model: "claude-sonnet-5",
  maxTokens: 1200,
  temperature: 0.4,
  topK: 30,
};

const PERSONAS: JourneyPersonaConfig[] = [
  {
    category: "postpartum_aftercare",
    label: "Midwife-like pregnancy & postpartum companion",
    roleOverlay:
      "For this Care plan, lean into a midwife-like presence for pregnancy and postpartum / nursing mothers: calm, practical, unhurried, one question at a time. Still not a clinician — organise care and escalate red flags.",
    knowledgeCategories: ["postpartum_aftercare"],
    text: DEEP_TEXT,
    voice: { ...DEFAULT_VOICE_TEXT, temperature: 0.35, topK: 25 },
    elevenLabsAgentIdEnv: "ELEVENLABS_AGENT_ID_POSTPARTUM",
  },
  {
    category: "gp_follow_up",
    label: "Clinic follow-up companion",
    roleOverlay:
      "For this Care plan, act like a calm clinic follow-through companion: hold the watch-list from the visit, notice changes, prepare one useful question for the next appointment.",
    knowledgeCategories: ["gp_follow_up"],
    text: DEFAULT_TEXT,
    voice: DEFAULT_VOICE_TEXT,
  },
  {
    category: "mental_wellbeing",
    label: "Mental wellbeing companion",
    roleOverlay:
      "For this Care plan, stay especially low-pressure and validating. Shrink tasks. Never therapise or diagnose.",
    knowledgeCategories: ["mental_wellbeing"],
    text: DEEP_TEXT,
    voice: { ...DEFAULT_VOICE_TEXT, temperature: 0.4 },
  },
  {
    category: "occupational_stress",
    label: "Work stress companion",
    roleOverlay:
      "For this Care plan, help organise work-related stress and its health spillover without telling them what career move to make.",
    knowledgeCategories: ["occupational_stress"],
    text: DEFAULT_TEXT,
    voice: DEFAULT_VOICE_TEXT,
  },
  {
    category: "medication_follow_through",
    label: "Medication follow-through companion",
    roleOverlay:
      "For this Care plan, focus on gentle medication follow-through and how they’re feeling — never change doses.",
    knowledgeCategories: ["medication_follow_through"],
    text: { ...DEFAULT_TEXT, temperature: 0.35, topK: 25 },
    voice: { ...DEFAULT_VOICE_TEXT, temperature: 0.3, topK: 20 },
  },
  {
    category: "recovery_aftercare",
    label: "Recovery companion",
    roleOverlay: "For this Care plan, pace recovery gently and respect clinician aftercare the user has shared.",
    knowledgeCategories: ["recovery_aftercare"],
    text: DEFAULT_TEXT,
    voice: DEFAULT_VOICE_TEXT,
  },
];

const DEFAULT_PERSONA: JourneyPersonaConfig = {
  category: "default",
  label: "Nura default",
  roleOverlay: "",
  knowledgeCategories: [],
  text: DEFAULT_TEXT,
  voice: DEFAULT_VOICE_TEXT,
};

const BY_CATEGORY = new Map(PERSONAS.map((p) => [p.category, p]));

export function getPersonaConfig(category: PlanCategory | string | null | undefined): JourneyPersonaConfig {
  if (!category) return DEFAULT_PERSONA;
  return BY_CATEGORY.get(category as PlanCategory) ?? DEFAULT_PERSONA;
}

export function resolvePersonaCategories(
  primary: PlanCategory | string | null | undefined,
  extras: Array<PlanCategory | string | null | undefined> = [],
): PlanCategory[] {
  const out: PlanCategory[] = [];
  const seen = new Set<string>();
  for (const value of [primary, ...extras]) {
    if (!value || seen.has(value)) continue;
    if (!(PLAN_CATEGORIES as readonly string[]).includes(value)) continue;
    seen.add(value);
    out.push(value as PlanCategory);
  }
  return out;
}

export type BuiltAgentContext = {
  categories: PlanCategory[];
  persona: JourneyPersonaConfig;
  /** Extra system prompt fragment (role + knowledge). */
  systemExtras: string;
  /** Compact brief for ElevenLabs dynamic variables. */
  knowledgeBrief: string;
  personaLabel: string;
  textParams: AgentGenerationParams;
  voiceParams: AgentGenerationParams;
  elevenLabsAgentId: string | undefined;
};

export function buildAgentContext(options: {
  primaryCategory?: PlanCategory | string | null;
  extraCategories?: Array<PlanCategory | string | null | undefined>;
  surface?: "text" | "voice";
}): BuiltAgentContext {
  const categories = resolvePersonaCategories(options.primaryCategory, options.extraCategories);
  const primary = categories[0] ?? null;
  const persona = getPersonaConfig(primary);
  const knowledgeCats =
    persona.knowledgeCategories.length > 0
      ? persona.knowledgeCategories
      : categories;
  const docs = loadKnowledgeForCategories(knowledgeCats);
  const knowledgeBlock = formatKnowledgeForPrompt(docs, options.surface === "voice" ? 3500 : 6000);
  const role = persona.roleOverlay.trim();
  const systemExtras = [role ? `PERSONA OVERLAY\n${role}` : "", knowledgeBlock].filter(Boolean).join("\n\n");

  const envName = persona.elevenLabsAgentIdEnv;
  const elevenLabsAgentId = envName ? process.env[envName] || undefined : undefined;

  return {
    categories,
    persona,
    systemExtras,
    knowledgeBrief: knowledgeBlock.slice(0, 3500),
    personaLabel: persona.label,
    textParams: persona.text,
    voiceParams: persona.voice,
    elevenLabsAgentId,
  };
}

/** Anthropic messages.create generation fields from persona params. */
export function anthropicGenerationFields(params: AgentGenerationParams) {
  // claude-sonnet-5 rejects temperature/top_k (invalid_request_error).
  // Keep model + max_tokens only for current production models.
  return {
    model: params.model,
    max_tokens: params.maxTokens,
  };
}
