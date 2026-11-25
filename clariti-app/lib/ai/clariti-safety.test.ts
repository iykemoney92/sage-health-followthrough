import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { analyzeClaritiDocument, analysisReaderText, type ClaritiAnalysis } from "./clariti-analysis";
import {
  DOSE_CHECK_FLAG,
  DATE_CHECK_LABEL,
  chatReplySafetyNote,
  dateOrderFor,
  dateRule,
  looksLikeRoughScan,
  readerFromHeaders,
  readerRegion,
  safetyFlagsFor,
  urgentCareRule,
  crisisRule,
  SCAM_RULE,
} from "./clariti-safety";
import fixture from "./fixtures/eval-2026-11-20.json";

type FixtureCase = { fileName: string; question: string | null; documentText: string; analysis?: ClaritiAnalysis; kind?: string };
const cases = fixture.cases as unknown as Record<string, FixtureCase>;
const a7 = cases["A7-poor-ocr"];
const a5 = cases["A5-warfarin-inr"];

const usage = {
  inputTokens: { total: 20, noCache: 20, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 7, text: 7, reasoning: undefined },
};

/** A model that answers with a saved analysis and remembers the prompt it was sent. */
function replayModel(analysis: ClaritiAnalysis) {
  const calls: Array<{ prompt: unknown }> = [];
  const model = new MockLanguageModelV4({
    provider: "anthropic.messages",
    modelId: "claude-opus-5",
    doGenerate: async (options) => {
      calls.push({ prompt: options.prompt });
      return { content: [{ type: "text", text: JSON.stringify(analysis) }], finishReason: { unified: "stop", raw: "end_turn" }, usage, warnings: [] };
    },
  });
  const systemPrompt = () => {
    const prompt = calls[0]?.prompt as Array<{ role: string; content: unknown }> | undefined;
    return String(prompt?.find((message) => message.role === "system")?.content ?? "");
  };
  return { model, calls, systemPrompt };
}

describe("reader locale", () => {
  it("reads the edge country and browser language, and ignores junk", () => {
    expect(readerFromHeaders(new Headers({ "x-vercel-ip-country": "gb", "accept-language": "en-GB,en;q=0.9" }))).toEqual({ country: "GB", language: "en-GB" });
    expect(readerFromHeaders(new Headers({ "x-vercel-ip-country": "<script>", "accept-language": "*" }))).toEqual({ country: null, language: null });
  });

  it("decides the region from the country only, never from en-US", () => {
    expect(readerRegion({ country: "GB" })).toBe("uk");
    expect(readerRegion({ country: "US" })).toBe("us");
    expect(readerRegion({ country: "PH" })).toBe("other");
    expect(readerRegion({ language: "en-US" })).toBe("unknown");
  });
});

describe("urgentCareRule", () => {
  it("names 999 and NHS 111 in the UK, and not 911", () => {
    const rule = urgentCareRule({ country: "GB" });
    expect(rule).toMatch(/999/);
    expect(rule).toMatch(/NHS 111/);
    expect(rule).toMatch(/Do not give 911/);
  });

  it("names 911 in the US, and not 999", () => {
    const rule = urgentCareRule({ country: "US" });
    expect(rule).toMatch(/call 911/);
    expect(rule).toMatch(/Do not give 999/);
  });

  it("gives both when Clariti does not know where the reader is", () => {
    for (const reader of [null, { language: "en-US" }]) {
      const rule = urgentCareRule(reader);
      expect(rule).toMatch(/999/);
      expect(rule).toMatch(/111/);
      expect(rule).toMatch(/911/);
    }
  });

  // 22 Nov Claude Code eval, F3: the country is known, so a reader in Ireland or
  // Nigeria must not be told "Clariti does not know where the reader is" and given 911.
  it.each([
    ["IE", /call 112 or 999/, /911/],
    ["NG", /call 112/, /999|911/],
    ["CA", /call 911/, /999|111/],
    ["AU", /call 000/, /999|911/],
    ["FR", /give 112/, /call 999|call 911/],
  ])("uses the reader's known country %s", (country, wanted, wrong) => {
    const rule = urgentCareRule({ country });
    expect(rule).toMatch(wanted);
    expect(rule.replace(/Do not give[^.]*\./g, "")).not.toMatch(wrong);
    expect(rule).not.toMatch(/does not know where the reader is/);
  });

  // 25 Nov eval, F1: PH now has its confirmed number (911); ZA has none confirmed.
  it("tells a reader in a country with no confirmed number to call the local emergency number, and never that a number does not work", () => {
    const rule = urgentCareRule({ country: "ZA" });
    expect(rule).toMatch(/local emergency number/);
    expect(rule).toMatch(/country code ZA/);
    expect(rule).not.toMatch(/does not know where the reader is/);
    expect(rule).not.toMatch(/which do not work there/);
    expect(urgentCareRule({ country: "PH" })).toMatch(/in the Philippines, call 911/);
  });
});

describe("crisisRule", () => {
  it("stops the task and puts the reader's own crisis line first", () => {
    const uk = crisisRule({ country: "GB" });
    expect(uk).toMatch(/stop the task/);
    expect(uk).toMatch(/suicide, self-harm, wanting to die/);
    expect(uk).toMatch(/overdose, or stockpiling pills/);
    expect(uk).toMatch(/Samaritans on 116 123/);
    expect(uk).toMatch(/999 if they are in immediate danger/);
    expect(uk).toMatch(/NHS 111/);
    expect(uk).toMatch(/If they mention abuse or someone hurting them, give the National Domestic Abuse Helpline on 0808 2000 247/);
    expect(uk).toMatch(/Childline on 0800 1111/);
    expect(uk).not.toMatch(/988|911/);

    const us = crisisRule({ country: "US" });
    expect(us).toMatch(/call or text 988/);
    expect(us).toMatch(/911 if they are in immediate danger/);
    expect(us).toMatch(/1-800-799-7233/);
    expect(us).not.toMatch(/116 123|999/);

    expect(crisisRule({ country: "IE" })).toMatch(/Samaritans on 116 123.*112 or 999/);
    expect(crisisRule({ country: "CA" })).toMatch(/9-8-8.*911/);
    expect(crisisRule({ country: "AU" })).toMatch(/Lifeline on 13 11 14.*000/);
    expect(crisisRule({ country: "NG" })).toMatch(/112/);
    expect(crisisRule({ country: "NG" })).not.toMatch(/116 123|988|999|911/);
  });

  it("gives the local number plus the UK and US lines when the country is unknown", () => {
    const rule = crisisRule(null);
    expect(rule).toMatch(/local emergency number/);
    expect(rule).toMatch(/116 123/);
    expect(rule).toMatch(/988/);
  });

  it("gives no UK or US numbers to a reader elsewhere", () => {
    const rule = crisisRule({ country: "ZA" });
    expect(rule).toMatch(/local emergency number/);
    expect(rule).not.toMatch(/116 123|988|999|911/);
  });
});

describe("SCAM_RULE", () => {
  it("says it looks like a scam, never to use its links or numbers, and to go to the official site", () => {
    expect(SCAM_RULE).toMatch(/say plainly at the start that it looks like a scam/);
    expect(SCAM_RULE).toMatch(/not to click its links, not to call or text any number in it/);
    expect(SCAM_RULE).toMatch(/official website/);
    expect(SCAM_RULE).toMatch(/Do not explain it as if it were genuine/);
  });
});

describe("dateRule", () => {
  it("tells the model to copy dates, read day/month unless clearly American, and give both readings when unsure", () => {
    const rule = dateRule("dmy", { country: "GB", language: "en-GB" });
    expect(rule).toMatch(/copy every date exactly as the document writes it/);
    expect(rule).toMatch(/day\/month\/year unless the document is clearly American/);
    expect(rule).toMatch(/give both readings, and say 'check this date'/);
    expect(rule).toMatch(/country code GB/);
    expect(dateRule("either", null)).toMatch(/give both readings and tell the user to check this date/);
    expect(dateRule("mdy", null)).toMatch(/month\/day\/year/);
  });
});

describe("looksLikeRoughScan", () => {
  it("spots the rough scan and leaves clean letters alone", () => {
    expect(looksLikeRoughScan(a7.documentText)).toBe(true);
    for (const id of ["A1-discharge-nstemi", "A5-warfarin-inr", "A10-methotrexate-weekly", "A12-appointment-prep"]) {
      expect(looksLikeRoughScan(cases[id].documentText), id).toBe(false);
    }
    expect(looksLikeRoughScan("HbA1c 48 mmol/mol, eGFR 72")).toBe(false);
    expect(looksLikeRoughScan("Warfarin 3[unclear] mg [unclear] daily, see [unclear] on [unclear]")).toBe(true);
  });
});

describe("safetyFlagsFor, replaying the 20 Nov eval outputs", () => {
  it("flags A7's misread date and its doses read off a rough scan", () => {
    const analysis = a7.analysis!;
    const order = dateOrderFor(a7.documentText, null);
    expect(order).toBe("dmy");
    const flags = safetyFlagsFor(analysisReaderText(analysis), a7.documentText, order, analysis.flags);
    const date = flags.find((flag) => flag.label === DATE_CHECK_LABEL);
    expect(date?.severity).toBe("check");
    expect(date?.detail).toContain('"11 Dec 2026"');
    expect(flags).toContainEqual(DOSE_CHECK_FLAG);
  });

  it("adds nothing to A5, whose dates and doses are all on a clean letter", () => {
    const analysis = a5.analysis!;
    const flags = safetyFlagsFor(analysisReaderText(analysis), a5.documentText, dateOrderFor(a5.documentText, null), analysis.flags);
    expect(flags).toEqual([]);
  });

  it("leaves correctly read UK dates alone on the other eval letters", () => {
    const a12 = cases["A12-appointment-prep"].documentText;
    const a1 = cases["A1-discharge-nstemi"].documentText;
    expect(safetyFlagsFor("Your gastroscopy is on Wednesday 2 December 2026 at 14:30. Stop omeprazole from 18 November 2026.", a12, dateOrderFor(a12, { country: "US" }), [])).toEqual([]);
    expect(safetyFlagsFor("You went home on 15 Nov 2026, three days after the stent on 12 November.", a1, dateOrderFor(a1, null), [])).toEqual([]);
    // ...and a date that is not on the letter is caught.
    expect(safetyFlagsFor("Stop omeprazole from 11 June 2026.", a12, dateOrderFor(a12, null), [])[0]?.label).toBe(DATE_CHECK_LABEL);
  });

  it("asks the reader to check an ambiguous date when the order cannot be told", () => {
    const flags = safetyFlagsFor("Your appointment is on 02/12/2026.", "Clinic appointment 02/12/2026 at 9am", "either", []);
    expect(flags[0]?.detail).toMatch(/02\/12\/2026 could mean 2 Dec 2026 or 12 Feb 2026/);
  });
});

describe("analyzeClaritiDocument", () => {
  beforeEach(() => {
    process.env.AI_GATEWAY_API_KEY = "test-only";
  });
  afterEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
  });

  it("puts the reader's numbers and the date and dose rules in the prompt, and flags A7 when replayed", async () => {
    const { model, systemPrompt } = replayModel(a7.analysis!);
    const result = await analyzeClaritiDocument(
      { kind: "medication_context", question: a7.question ?? "", documentText: a7.documentText, reader: { country: "GB", language: "en-GB" } },
      () => model,
    );

    const system = systemPrompt();
    expect(system).toMatch(/call 999 in an emergency, or NHS 111/);
    expect(system).not.toMatch(/in the US, call 911/);
    expect(system).toMatch(/DATES: copy every date exactly/);
    expect(system).toMatch(/DOSES FROM A ROUGH SCAN/);
    expect(system).toMatch(/ask their pharmacist/);
    expect(system).toMatch(/CRISIS: .*Samaritans on 116 123/);
    expect(system).toMatch(/SCAMS: /);

    expect(result.degraded).toBe(false);
    expect(result.analysis.title).toBe(a7.analysis!.title); // flagged, never rewritten
    const labels = result.analysis.flags.map((flag) => flag.label);
    expect(labels).toContain(DATE_CHECK_LABEL);
    expect(labels).toContain(DOSE_CHECK_FLAG.label);
  });

  it("asks for a calm, factual safetyNote, never a reassuring one (22 Nov eval, F5)", async () => {
    const replay = replayModel(a5.analysis!);
    await analyzeClaritiDocument({ kind: "medication_context", question: "", documentText: a5.documentText, reader: { country: "IE" } }, () => replay.model);
    const messages = replay.calls[0]?.prompt as Array<{ role: string; content: unknown }>;
    const everything = JSON.stringify(messages);
    expect(everything).not.toMatch(/safetyNote must be one short reassuring sentence/);
    expect(everything).toMatch(/safetyNote must be one short, calm, factual sentence that is true from the document: no comfort or reassurance the document does not give/);
    expect(replay.systemPrompt()).toMatch(/in Ireland, call 112 or 999/);
    expect(replay.systemPrompt()).not.toMatch(/does not know where the reader is/);
  });

  it("gives a US reader 911 and an unknown reader both", async () => {
    const us = replayModel(a5.analysis!);
    await analyzeClaritiDocument({ kind: "medication_context", question: "", documentText: a5.documentText, reader: { country: "US" } }, () => us.model);
    expect(us.systemPrompt()).toMatch(/in the US, call 911/);

    const nobody = replayModel(a5.analysis!);
    const result = await analyzeClaritiDocument({ kind: "medication_context", question: "", documentText: a5.documentText }, () => nobody.model);
    expect(nobody.systemPrompt()).toMatch(/give both: in the UK call 999 \(or NHS 111 for urgent advice\), in the US call 911/);
    expect(result.analysis.flags).toEqual(a5.analysis!.flags);
  });
});

describe("chatReplySafetyNote", () => {
  it("adds a check line for a misread date and an unchecked dose from a rough scan", () => {
    const note = chatReplySafetyNote(
      "Your review on 11 Dec 2026 lists metformin 500mg twice a day.",
      [a7.documentText, "What medicines am I supposed to take now?"],
      a7.documentText,
      "dmy",
    );
    expect(note).toContain('"11 Dec 2026"');
    expect(note).toMatch(/pharmacist/);
  });

  it("stays quiet when the reply copies dates and already sends the reader to the pharmacist", () => {
    expect(chatReplySafetyNote(
      "Your review dated l2/ll/2026 (12 Nov) lists metformin 5OOmg, which looks like 500mg. Check it against your copy or ask your pharmacist.",
      [a7.documentText],
      a7.documentText,
      "dmy",
    )).toBe("");
    expect(chatReplySafetyNote("Your next INR test is on Tuesday 25 November at 10:15.", [a5.documentText], a5.documentText, "dmy")).toBe("");
  });
});
