import { describe, expect, it } from "vitest";
import { promptsForInterests } from "./intake-prompts";

describe("promptsForInterests", () => {
  it("only shows pregnancy starters when only pregnancy is selected", () => {
    const labels = promptsForInterests(["Pregnancy & postpartum"]).map(([label]) => label);
    expect(labels).toEqual([
      "Pregnancy & postpartum",
      "Pregnancy check-ins",
      "Recovery after birth",
      "Feeding & baby",
    ]);
    expect(labels).not.toContain("GP follow-up");
    expect(labels).not.toContain("New medication");
  });
});
