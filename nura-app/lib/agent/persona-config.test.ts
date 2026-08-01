import { describe, expect, it } from "vitest";
import { getKnowledgeForCategory, loadKnowledgeForCategories } from "@/lib/agent/knowledge";
import { buildAgentContext, getPersonaConfig } from "@/lib/agent/persona-config";

describe("agent knowledge + persona", () => {
  it("loads postpartum knowledge pack", () => {
    const doc = getKnowledgeForCategory("postpartum_aftercare");
    expect(doc?.id).toBe("postpartum_aftercare");
    expect(doc?.body.toLowerCase()).toContain("midwife");
  });

  it("builds midwife-like persona context for postpartum", () => {
    const ctx = buildAgentContext({ primaryCategory: "postpartum_aftercare", surface: "text" });
    expect(ctx.personaLabel.toLowerCase()).toContain("midwife");
    expect(ctx.systemExtras).toContain("PERSONA OVERLAY");
    expect(ctx.systemExtras.toLowerCase()).toContain("postpartum");
    expect(ctx.textParams.temperature).toBeLessThan(0.5);
    expect(loadKnowledgeForCategories(["postpartum_aftercare"]).length).toBe(1);
  });

  it("falls back to default persona for unknown categories", () => {
    expect(getPersonaConfig("not_a_real_category").category).toBe("default");
  });
});
