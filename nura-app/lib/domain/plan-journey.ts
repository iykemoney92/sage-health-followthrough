import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

export type JourneyStep = {
  id: string;
  title: string;
  contextPrompt: string;
  status: "pending" | "active" | "done";
  orderIndex: number;
};

export type JourneyMilestone = {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "active" | "done";
  orderIndex: number;
  steps: JourneyStep[];
};

export type PlanForJourney = {
  id: string;
  title: string;
  why_this_exists: string;
  current_focus: string;
  next_step: string;
};

type DraftStep = { title: string; context_prompt: string };
type DraftMilestone = { title: string; description: string; steps: DraftStep[] };

const FALLBACK_JOURNEY: DraftMilestone[] = [
  {
    title: "Get oriented",
    description: "Make sure Nura understands the full picture before anything else.",
    steps: [
      { title: "Share what's going on", context_prompt: "Ask the user to fill in any detail about this Thread that hasn't come up yet, so Nura has the full picture." },
      { title: "Confirm the plan", context_prompt: "Check the plan so far makes sense to the user and ask if anything should change before moving forward." },
    ],
  },
  {
    title: "Build the habit",
    description: "Turn the plan into something that actually happens day to day.",
    steps: [
      { title: "Log a first update", context_prompt: "Ask the user for a quick honest update on how things have been since this Thread started." },
      { title: "Talk through a tricky day", context_prompt: "Ask the user to describe a day this was hardest to keep up with, and what got in the way." },
    ],
  },
  {
    title: "Check the progress",
    description: "Step back and see what's actually changed.",
    steps: [
      { title: "Review how it's going", context_prompt: "Ask the user to reflect on what's better, what's not, and whether the current approach still fits." },
      { title: "Decide what's next", context_prompt: "Help the user decide whether to keep going as-is, adjust the plan, or wind this Thread down." },
    ],
  },
];

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 12000) {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function isValidDraft(value: unknown): value is DraftMilestone[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((m) => {
    if (!m || typeof m !== "object") return false;
    const milestone = m as Record<string, unknown>;
    if (typeof milestone.title !== "string" || !milestone.title.trim()) return false;
    if (!Array.isArray(milestone.steps) || milestone.steps.length === 0) return false;
    return milestone.steps.every((s) => {
      if (!s || typeof s !== "object") return false;
      const step = s as Record<string, unknown>;
      return typeof step.title === "string" && step.title.trim() && typeof step.context_prompt === "string" && step.context_prompt.trim();
    });
  });
}

async function draftJourney(plan: PlanForJourney): Promise<DraftMilestone[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return FALLBACK_JOURNEY;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1200,
      system:
        "You are Nura, a warm AI health and wellbeing companion. Turn one of the user's Threads into a short journey - a small, encouraging roadmap of what working through this Thread with Nura could look like, broken into Milestones, each with a couple of concrete Steps. " +
        "This is not a rigid clinical care plan - it's a light, human structure to help the user feel oriented and see progress. Keep language warm and plain, never clinical. Never diagnose, prescribe, or give medical advice. " +
        "Produce exactly 3 Milestones. Each Milestone needs 2-3 Steps. Each Step needs a short title (2-6 words, action-oriented, e.g. 'Log how sleep has been') and a context_prompt: one sentence telling Nura specifically what to focus the conversation on when the user starts that Step - this gets used to ground Nura's next reply, so make it concrete and specific to this Thread, not generic.",
      tools: [
        {
          name: "build_journey",
          description: "Record the generated journey of Milestones and Steps for this Thread.",
          input_schema: {
            type: "object",
            properties: {
              milestones: {
                type: "array",
                description: "Exactly 3 milestones, in order.",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "2-5 words." },
                    description: { type: "string", description: "One short sentence describing this milestone." },
                    steps: {
                      type: "array",
                      description: "2-3 steps for this milestone.",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string", description: "2-6 words, action-oriented." },
                          context_prompt: { type: "string", description: "One sentence: what Nura should focus on when the user starts this step." },
                        },
                        required: ["title", "context_prompt"],
                      },
                    },
                  },
                  required: ["title", "description", "steps"],
                },
              },
            },
            required: ["milestones"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "build_journey" },
      messages: [
        {
          role: "user",
          content:
            `Thread title: ${plan.title}\nWhy this exists: ${plan.why_this_exists}\nCurrent focus: ${plan.current_focus}\nNext step: ${plan.next_step}`,
        },
      ],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return FALLBACK_JOURNEY;

    const raw = (toolUse.input as { milestones?: unknown }).milestones;
    if (!isValidDraft(raw)) return FALLBACK_JOURNEY;
    return raw;
  } catch {
    return FALLBACK_JOURNEY;
  }
}

function toJourney(
  milestoneRows: { id: string; title: string; description: string | null; status: string; order_index: number }[],
  stepRows: { id: string; milestone_id: string; title: string; context_prompt: string; status: string; order_index: number }[],
): JourneyMilestone[] {
  return milestoneRows
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      status: m.status as JourneyMilestone["status"],
      orderIndex: m.order_index,
      steps: stepRows
        .filter((s) => s.milestone_id === m.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => ({
          id: s.id,
          title: s.title,
          contextPrompt: s.context_prompt,
          status: s.status as JourneyStep["status"],
          orderIndex: s.order_index,
        })),
    }));
}

const FALLBACK_STEP_REPLY = "Let's dig into this together - tell me a bit more about where things stand right now.";

export async function respondToStepStart(
  plan: PlanForJourney,
  milestone: { title: string },
  step: { title: string; contextPrompt: string },
  recentHistory: { role: "user" | "assistant"; content: string }[] = [],
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return FALLBACK_STEP_REPLY;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      system:
        "You are Nura, a warm AI health and wellbeing companion (never a doctor or therapist - no diagnosis, prescriptions, or medical advice). " +
        `The user just chose to start the Step "${step.title}" (part of the Milestone "${milestone.title}") within their Thread "${plan.title}". ` +
        `Here's specifically what this Step should focus on: ${step.contextPrompt} ` +
        "Reply with 1-3 warm, natural sentences that kick off this focused part of the conversation - reference the Step's focus directly and ask one genuine, specific question to get things started. Do not just repeat the Step title back at them.",
      messages: [
        ...recentHistory.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: "user" as const, content: `Let's work on: ${step.title}` },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text.trim()) return FALLBACK_STEP_REPLY;
    return textBlock.text.trim();
  } catch {
    return FALLBACK_STEP_REPLY;
  }
}

export async function completeStepAndCascade(supabase: SupabaseClient, stepId: string, milestoneId: string) {
  await supabase
    .from("nura_plan_steps")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", stepId);

  const { data: siblingSteps } = await supabase.from("nura_plan_steps").select("status").eq("milestone_id", milestoneId);
  const allDone = (siblingSteps ?? []).length > 0 && (siblingSteps ?? []).every((s) => s.status === "done");
  await supabase.from("nura_plan_milestones").update({ status: allDone ? "done" : "active" }).eq("id", milestoneId);
}

type AdjustedDraft = { currentMilestoneSteps: DraftStep[]; upcomingMilestones: DraftMilestone[] };

function isValidStepArray(value: unknown): value is DraftStep[] {
  return Array.isArray(value) && value.every((s) => {
    if (!s || typeof s !== "object") return false;
    const step = s as Record<string, unknown>;
    return typeof step.title === "string" && step.title.trim() && typeof step.context_prompt === "string" && step.context_prompt.trim();
  });
}

async function draftAdjustedJourney(
  plan: PlanForJourney,
  lockedSummary: string,
  adjustableSummary: string,
  recentHistory: { role: "user" | "assistant"; content: string }[],
): Promise<AdjustedDraft | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1200,
      system:
        "You are Nura, a warm AI health and wellbeing companion, quietly revising the journey (Milestones/Steps) for one of the user's Threads based on how the conversation has evolved. " +
        "Some parts of this journey are already completed and LOCKED - never repeat, contradict, remove, or reference needing to redo them. You are only ever adjusting what's still ahead: the remaining Steps of the milestone currently in progress, and any milestones that haven't started yet. " +
        "Keep what still fits as-is, rewrite anything that no longer matches where the user actually is, add something new if the conversation revealed a real need, or drop something that's no longer relevant. Small, sensible adjustments - do not reinvent the whole journey. It is completely fine to keep things unchanged if nothing warrants a change. Never diagnose, prescribe, or give medical advice.",
      tools: [
        {
          name: "adjust_journey",
          description: "Record the adjusted (or unchanged) remaining journey.",
          input_schema: {
            type: "object",
            properties: {
              current_milestone_steps: {
                type: "array",
                description: "Replacement list of remaining steps for the milestone currently in progress. Empty array if there is no milestone in progress right now, or if it has no remaining steps.",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "2-6 words, action-oriented." },
                    context_prompt: { type: "string", description: "One sentence: what Nura should focus on when the user starts this step." },
                  },
                  required: ["title", "context_prompt"],
                },
              },
              upcoming_milestones: {
                type: "array",
                description: "Replacement list of not-yet-started milestones, in order. Can be empty if none are needed right now.",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "2-5 words." },
                    description: { type: "string", description: "One short sentence." },
                    steps: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          context_prompt: { type: "string" },
                        },
                        required: ["title", "context_prompt"],
                      },
                    },
                  },
                  required: ["title", "description", "steps"],
                },
              },
            },
            required: ["current_milestone_steps", "upcoming_milestones"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "adjust_journey" },
      messages: [
        ...recentHistory.map((turn) => ({ role: turn.role, content: turn.content })),
        {
          role: "user" as const,
          content:
            `Thread: ${plan.title}\n\nAlready completed (locked - do not touch):\n${lockedSummary || "Nothing yet."}\n\n` +
            `Still ahead (adjustable):\n${adjustableSummary}\n\n` +
            "Based on the conversation, decide whether the remaining journey still fits or needs adjusting, then call adjust_journey with the result (unchanged is a valid answer).",
        },
      ],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    const raw = toolUse.input as { current_milestone_steps?: unknown; upcoming_milestones?: unknown };
    if (!isValidStepArray(raw.current_milestone_steps)) return null;
    if (!isValidDraft(raw.upcoming_milestones) && !(Array.isArray(raw.upcoming_milestones) && raw.upcoming_milestones.length === 0)) return null;

    return {
      currentMilestoneSteps: raw.current_milestone_steps,
      upcomingMilestones: (raw.upcoming_milestones as DraftMilestone[]) ?? [],
    };
  } catch {
    return null;
  }
}

export async function regeneratePendingJourney(
  supabase: SupabaseClient,
  ownerId: string,
  plan: PlanForJourney,
  recentHistory: { role: "user" | "assistant"; content: string }[] = [],
): Promise<void> {
  const [{ data: milestoneRows }, { data: stepRows }] = await Promise.all([
    supabase.from("nura_plan_milestones").select("id, title, description, status, order_index").eq("plan_id", plan.id).order("order_index", { ascending: true }),
    supabase.from("nura_plan_steps").select("id, milestone_id, title, context_prompt, status, order_index").eq("plan_id", plan.id).order("order_index", { ascending: true }),
  ]);

  const milestones = milestoneRows ?? [];
  const steps = stepRows ?? [];
  if (milestones.length === 0) return;

  const doneMilestones = milestones.filter((m) => m.status === "done");
  const activeMilestone = milestones.find((m) => m.status === "active") ?? null;
  const futurePending = milestones.filter((m) => m.status === "pending");

  const doneStepsOfActive = activeMilestone ? steps.filter((s) => s.milestone_id === activeMilestone.id && s.status === "done") : [];
  const pendingStepsOfActive = activeMilestone ? steps.filter((s) => s.milestone_id === activeMilestone.id && s.status !== "done") : [];

  if (!activeMilestone && futurePending.length === 0) return;

  const lockedSummary = [
    ...doneMilestones.map((m) => `- Milestone (completed): ${m.title}`),
    ...doneStepsOfActive.map((s) => `- Step (completed, part of current milestone "${activeMilestone!.title}"): ${s.title}`),
  ].join("\n");

  const adjustableSummary = [
    activeMilestone
      ? `Current milestone in progress: "${activeMilestone.title}" - ${activeMilestone.description ?? ""}. Its remaining steps: ${pendingStepsOfActive.map((s) => s.title).join(", ") || "none yet"}.`
      : "No milestone currently in progress.",
    futurePending.length > 0 ? `Upcoming milestones not yet started: ${futurePending.map((m) => `"${m.title}"`).join(", ")}.` : "No upcoming milestones queued yet.",
  ].join("\n");

  const draft = await withTimeout(draftAdjustedJourney(plan, lockedSummary, adjustableSummary, recentHistory), null, 15000);
  if (!draft) return;

  if (activeMilestone && draft.currentMilestoneSteps.length > 0) {
    const pendingIds = pendingStepsOfActive.map((s) => s.id);
    if (pendingIds.length > 0) {
      await supabase.from("nura_plan_steps").delete().in("id", pendingIds);
    }
    const baseIndex = doneStepsOfActive.length;
    const payload = draft.currentMilestoneSteps.map((s, i) => ({
      owner_id: ownerId,
      plan_id: plan.id,
      milestone_id: activeMilestone.id,
      title: s.title,
      context_prompt: s.context_prompt,
      order_index: baseIndex + i,
      status: "pending",
    }));
    await supabase.from("nura_plan_steps").insert(payload);
  }

  const futureIds = futurePending.map((m) => m.id);
  if (futureIds.length > 0) {
    await supabase.from("nura_plan_milestones").delete().in("id", futureIds);
  }

  const baseOrder = milestones.length - futurePending.length;
  for (let i = 0; i < draft.upcomingMilestones.length; i++) {
    const m = draft.upcomingMilestones[i];
    const { data: newMilestone } = await supabase
      .from("nura_plan_milestones")
      .insert({ owner_id: ownerId, plan_id: plan.id, title: m.title, description: m.description ?? null, order_index: baseOrder + i, status: "pending" })
      .select("id")
      .single();
    if (!newMilestone) continue;

    const stepPayload = m.steps.map((s, j) => ({
      owner_id: ownerId,
      plan_id: plan.id,
      milestone_id: newMilestone.id as string,
      title: s.title,
      context_prompt: s.context_prompt,
      order_index: j,
      status: "pending",
    }));
    if (stepPayload.length > 0) {
      await supabase.from("nura_plan_steps").insert(stepPayload);
    }
  }
}

export async function evaluateAndAdvanceJourney(
  supabase: SupabaseClient,
  ownerId: string,
  plan: PlanForJourney,
  userContent: string,
  replyContent: string,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const { data: activeStep } = await supabase
    .from("nura_plan_steps")
    .select("id, milestone_id, title, context_prompt")
    .eq("plan_id", plan.id)
    .eq("status", "active")
    .maybeSingle();

  if (!activeStep) return;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 150,
      system:
        `You are silently reviewing one exchange in a longer conversation to decide one narrow thing: has the Step "${activeStep.title as string}" been meaningfully addressed? ` +
        `What this Step should cover: ${activeStep.context_prompt as string} ` +
        "Only say satisfied=true if this exchange genuinely engaged with that focus, not just because the conversation continued or moved on.",
      tools: [
        {
          name: "evaluate",
          description: "Record whether the step was satisfied by this exchange.",
          input_schema: { type: "object", properties: { satisfied: { type: "boolean" } }, required: ["satisfied"] },
        },
      ],
      tool_choice: { type: "tool", name: "evaluate" },
      messages: [{ role: "user", content: `User: ${userContent}\nNura: ${replyContent}` }],
    });

    const toolUse = message.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return;
    const satisfied = Boolean((toolUse.input as { satisfied?: boolean }).satisfied);
    if (!satisfied) return;

    await completeStepAndCascade(supabase, activeStep.id as string, activeStep.milestone_id as string);
    await regeneratePendingJourney(supabase, ownerId, plan, [
      { role: "user", content: userContent },
      { role: "assistant", content: replyContent },
    ]);
  } catch {
    // best-effort - never break the main chat flow over journey bookkeeping
  }
}

export async function ensureJourney(
  supabase: SupabaseClient,
  ownerId: string,
  plan: PlanForJourney,
): Promise<JourneyMilestone[]> {
  const { data: existingMilestones } = await supabase
    .from("nura_plan_milestones")
    .select("id, title, description, status, order_index")
    .eq("plan_id", plan.id)
    .order("order_index", { ascending: true });

  if (existingMilestones && existingMilestones.length > 0) {
    const { data: existingSteps } = await supabase
      .from("nura_plan_steps")
      .select("id, milestone_id, title, context_prompt, status, order_index")
      .eq("plan_id", plan.id)
      .order("order_index", { ascending: true });
    return toJourney(existingMilestones as never, (existingSteps ?? []) as never);
  }

  const draft = await withTimeout(draftJourney(plan), FALLBACK_JOURNEY, 15000);

  const insertedMilestones: { id: string; title: string; description: string | null; status: string; order_index: number }[] = [];
  const insertedSteps: { id: string; milestone_id: string; title: string; context_prompt: string; status: string; order_index: number }[] = [];

  for (let i = 0; i < draft.length; i++) {
    const milestone = draft[i];
    const { data: milestoneRow, error } = await supabase
      .from("nura_plan_milestones")
      .insert({
        owner_id: ownerId,
        plan_id: plan.id,
        title: milestone.title,
        description: milestone.description ?? null,
        order_index: i,
        status: i === 0 ? "active" : "pending",
      })
      .select("id, title, description, status, order_index")
      .single();

    if (error || !milestoneRow) continue;
    insertedMilestones.push(milestoneRow as never);

    const stepPayload = milestone.steps.map((step, j) => ({
      owner_id: ownerId,
      plan_id: plan.id,
      milestone_id: milestoneRow.id as string,
      title: step.title,
      context_prompt: step.context_prompt,
      order_index: j,
      status: "pending",
    }));

    if (stepPayload.length > 0) {
      const { data: stepRows } = await supabase
        .from("nura_plan_steps")
        .insert(stepPayload)
        .select("id, milestone_id, title, context_prompt, status, order_index");
      if (stepRows) insertedSteps.push(...(stepRows as never[]));
    }
  }

  return toJourney(insertedMilestones, insertedSteps);
}
