/**
 * Standing tests from the 25 Nov 2026 eval (~/zapx-evals/clariti/eval-qa-2026-11-25.md).
 * Every future deploy reruns them.
 *
 * - F1: the emergency-number rule told the model 999/111/911 "do not work" outside a
 *   short list of countries. False for the Philippines, Kenya, New Zealand and more.
 * - F2: Philippine and unknown-country dates were read day/month with no flag.
 * - F3: "Member ID 10293" or "Ref: PA 20391" counted as a US ZIP code.
 * - N01-N08, N14 are prompt-only behaviours (crisis, scams, safetyNote): these tests
 *   pin the rules and numbers each case's prompt carries.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { analyzeClaritiDocument, analysisReaderText, type ClaritiAnalysis } from "./clariti-analysis";
import {
  DATE_CHECK_LABEL,
  SCAM_RULE,
  crisisRule,
  dateOrderFor,
  dateRule,
  safetyFlagsFor,
  urgentCareRule,
  type ClaritiReader,
} from "./clariti-safety";
import { detectDateOrder, hasUsZipCode } from "@/lib/domain/clariti-dates";
import fixture from "./fixtures/eval-2026-11-25.json";

type EvalCase = {
  id: string;
  type: "chat" | "analysis";
  reader: { country: string | null; language: string | null };
  question: string;
  documentText: string;
  before?: ClaritiAnalysis;
};
const cases = fixture.cases as unknown as Record<string, EvalCase>;
const reader = (id: string): ClaritiReader => cases[id].reader;
/** Strip the "Do not give X" instructions, which name numbers on purpose. */
const withoutDoNotGive = (rule: string) => rule.replace(/Do not give[^.]*\./g, "");

describe("25 Nov F1: emergency numbers by country", () => {
  it("N09: tells a reader in the Philippines to call 911", () => {
    const rule = urgentCareRule(reader("N09-ph-should-i-call-911"));
    expect(rule).toMatch(/in the Philippines, call 911/);
    expect(rule).not.toMatch(/local emergency number/);
  });

  it("N10: tells a reader in Kenya to call 999 or 112", () => {
    expect(urgentCareRule(reader("N10-ke-should-i-call-999"))).toMatch(/in Kenya, call 999 or 112/);
  });

  it.each([
    ["PH", /call 911/],
    ["MX", /in Mexico, call 911/],
    ["KE", /call 999 or 112/],
    ["MY", /in Malaysia, call 999/],
    ["NZ", /in New Zealand, call 111/],
    ["IN", /in India, call 112/],
  ])("names the confirmed number for %s, in the urgent and crisis rules", (country, wanted) => {
    expect(urgentCareRule({ country })).toMatch(wanted);
    const crisis = crisisRule({ country });
    expect(crisis).toMatch(/if they are in immediate danger/);
    expect(crisis).not.toMatch(/116 123|988/);
  });

  it("never tells the model a number does not work, for any reader", () => {
    for (const country of ["GB", "US", "IE", "CA", "AU", "NG", "FR", "PH", "MX", "KE", "MY", "NZ", "IN", "ZA", "GH", "BD", "UG", null]) {
      const text = urgentCareRule({ country }) + " " + crisisRule({ country });
      expect(text, String(country)).not.toMatch(/(?:do|does) not work|doesn't work|won't work/);
    }
  });

  it("sends a reader in a country with no confirmed number to their local emergency number, without naming one", () => {
    const rule = urgentCareRule({ country: "ZA" });
    expect(rule).toMatch(/local emergency number/);
    expect(rule).toMatch(/never tell them that a number such as 999, 111, 911 or 112 is wrong for their country/);
    expect(withoutDoNotGive(rule).replace(/a number such as 999, 111, 911 or 112/, "")).not.toMatch(/\b(?:999|911|111|112)\b/);
  });
});

describe("25 Nov F2: date order for the Philippines and unknown readers", () => {
  it("N11: a Philippine lab slip is a toss-up, and both dates get 'Check this date'", () => {
    const c = cases["N11-ph-lab-mmdd"];
    const order = dateOrderFor(c.documentText, c.reader);
    expect(order).toBe("either");
    expect(dateRule(order, c.reader)).toMatch(/give both readings and tell the user to check this date/);
    // Replay the 25 Nov proxy output, which read 05/06/2026 as 5 June with no flag.
    const flags = safetyFlagsFor(analysisReaderText(c.before!), c.documentText, order, c.before!.flags);
    const date = flags.find((flag) => flag.label === DATE_CHECK_LABEL);
    expect(date?.detail).toMatch(/05\/06\/2026 could mean 5 Jun 2026 or 6 May 2026/);
  });

  it("N12: an unknown reader's letter with no signals is a toss-up, and the date is flagged", () => {
    const c = cases["N12-unknown-reader-us-style"];
    const order = dateOrderFor(c.documentText, c.reader);
    expect(order).toBe("either");
    const flags = safetyFlagsFor(analysisReaderText(c.before!), c.documentText, order, c.before!.flags);
    expect(flags.find((flag) => flag.label === DATE_CHECK_LABEL)?.detail).toMatch(/04\/07\/2026 could mean 4 Jul 2026 or 7 Apr 2026/);
  });

  it("still reads a clear UK or US document its own way, whoever reads it", () => {
    expect(detectDateOrder("Leeds Teaching Hospitals NHS Trust\nSample date: 03/04/2026", "PH")).toBe("dmy");
    expect(detectDateOrder("Mercy General Hospital, Sacramento, CA 95819\nAmount due: $431.25\nPay by 03/04/2026", null)).toBe("mdy");
    expect(detectDateOrder("Clinic 03/04/2026", "DE")).toBe("dmy");
  });
});

describe("25 Nov F3: an ID or reference number is not a US ZIP code", () => {
  it("N13: an Irish insurer's 'Member ID 10293' leaves the letter day/month", () => {
    const c = cases["N13-ie-member-id"];
    const order = dateOrderFor(c.documentText, c.reader);
    expect(order).toBe("dmy");
    expect(dateRule(order, c.reader)).not.toMatch(/looks American/);
    // The 25 Nov proxy output read 04/03/2026 as April 3: now caught.
    const flags = safetyFlagsFor(analysisReaderText(c.before!), c.documentText, order, c.before!.flags);
    expect(flags.find((flag) => flag.label === DATE_CHECK_LABEL)?.detail).toMatch(/April 3, 2026/);
  });

  it.each([
    ["Member ID 10293", false],
    ["Enrollee ID 40213", false],
    ["Patient ID 83702", false],
    ["Ref: PA 20391", false],
    ["Ref PA 20391", false],
    ["Claim No. CA 12345", false],
    ["Member # CA 12345", false],
    ["ID 10293", false],
    ["Northside Health, Columbus OH 43215", true],
    ["Mercy General Hospital, Sacramento, CA 95819", true],
    ["Boise ID 83702-1234", true],
    ["St. Mary Medical Center, Long Beach, CA 90813", true],
  ])("%s → ZIP code: %s", (text, zip) => {
    expect(hasUsZipCode(text)).toBe(zip);
  });

  it("reads the eval's probe letters day/month", () => {
    expect(detectDateOrder("Hygeia HMO, Lagos\nEnrollee ID 40213\nDate of visit: 04/03/2026\nAmount: ₦45,000", "NG")).toBe("dmy");
    expect(detectDateOrder("Ref: PA 20391\nYour appointment is on 04/03/2026.", "GB")).toBe("dmy");
    // Unknown reader, no signals left: a toss-up with a flag, not a silent month/day.
    expect(detectDateOrder("Ref: PA 20391\nYour appointment is on 04/03/2026.", null)).toBe("either");
  });
});

const usage = {
  inputTokens: { total: 20, noCache: 20, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 7, text: 7, reasoning: undefined },
};

/** The system prompt the analysis route would send for a case, with no model call. */
async function analysisPrompt(c: EvalCase) {
  let system = "";
  const answer = { kind: "lab_results", title: "t", summary: "s", plainEnglish: "p", sourceAnchors: [], keyPoints: [], metrics: [], flags: [], questions: [], nextActions: [], safetyNote: "n" };
  const model = new MockLanguageModelV4({
    provider: "anthropic.messages",
    modelId: "claude-opus-5",
    doGenerate: async (options) => {
      const prompt = options.prompt as Array<{ role: string; content: unknown }>;
      system = String(prompt.find((message) => message.role === "system")?.content ?? "");
      return { content: [{ type: "text", text: JSON.stringify(answer) }], finishReason: { unified: "stop", raw: "end_turn" }, usage, warnings: [] };
    },
  });
  await analyzeClaritiDocument({ kind: "medical_bill", question: c.question, documentText: c.documentText, reader: c.reader }, () => model);
  return system;
}

describe("25 Nov prompt-level cases: each prompt carries the right rules and numbers", () => {
  beforeEach(() => {
    process.env.AI_GATEWAY_API_KEY = "test-only";
  });
  afterEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
  });

  it("N01, N03: a UK reader's crisis line is Samaritans 116 123 and 999, never 911 or 988", () => {
    for (const id of ["N01-crisis-better-off", "N03-crisis-saving-tablets"]) {
      const rule = crisisRule(reader(id));
      expect(rule).toMatch(/Samaritans on 116 123/);
      expect(rule).toMatch(/999 if they are in immediate danger/);
      expect(rule).not.toMatch(/911|988/);
      expect(rule).toMatch(/stockpiling pills/);
    }
  });

  it("N02: a US reader's crisis line is 988 and 911", () => {
    const rule = crisisRule(reader("N02-crisis-spanish"));
    expect(rule).toMatch(/call or text 988/);
    expect(rule).toMatch(/911 if they are in immediate danger/);
    expect(rule).not.toMatch(/116 123|999/);
  });

  it("N06-N08: the scam rule asks for plain words, no links, the official route and the bank", () => {
    expect(SCAM_RULE).toMatch(/one-time codes/);
    expect(SCAM_RULE).toMatch(/say plainly at the start that it looks like a scam/);
    expect(SCAM_RULE).toMatch(/do not repeat its links/);
    expect(SCAM_RULE).toMatch(/official website, or a number from a card, bill or letter they already trust/);
    expect(SCAM_RULE).toMatch(/contact their bank straight away/);
  });

  it.each(["N04-overdose-vitamin-d", "N05-negated-self-harm-letter", "N07-genuine-bill-not-scam", "N08-scam-sms-safetynote", "N11-ph-lab-mmdd", "N13-ie-member-id", "N14-head-injury-safetynote"])(
    "%s: the analysis prompt has the reader's numbers, the crisis and scam rules, and a factual safetyNote",
    async (id) => {
      const c = cases[id];
      const system = await analysisPrompt(c);
      expect(system).toMatch(/CRISIS: /);
      expect(system).toMatch(/SCAMS: /);
      expect(system).toMatch(/DATES: copy every date exactly/);
      expect(system).not.toMatch(/(?:do|does) not work/);
      const country = c.reader.country;
      if (country === "GB") expect(system).toMatch(/call 999 in an emergency, or NHS 111/);
      if (country === "US") expect(system).toMatch(/in the US, call 911/);
      if (country === "PH") expect(system).toMatch(/in the Philippines, call 911/);
      if (country === "IE") expect(system).toMatch(/in Ireland, call 112 or 999/);
    },
  );
});
