import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Health data must never become readable by a Care circle. Circle access is granted
 * with `circle_member_read` policies (0025); this fails if any migration ever adds
 * one, or any policy calling nura_is_circle_member, to a nura_health_* table.
 */
describe("health tables RLS", () => {
  const dir = path.resolve(__dirname, "../../supabase/migrations");
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(path.join(dir, f), "utf8"))
    .join("\n");

  it("has no circle policy on any health table", () => {
    const policies = sql.match(/create policy[\s\S]*?;/gi) ?? [];
    const onHealth = policies.filter((p) => /\bon\s+(public\.)?nura_health_/i.test(p));
    expect(onHealth.length).toBeGreaterThan(0);
    for (const policy of onHealth) {
      expect(policy).not.toMatch(/circle/i);
    }
  });
});
