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
    for (const reader of [null, { country: "PH" }, { language: "en-US" }]) {
      const rule = urgentCareRule(reader);
      expect(rule).toMatch(/999/);
      expect(rule).toMatch(/111/);
      expect(rule).toMatch(/911/);
    }
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

    expect(result.degraded).toBe(false);
    expect(result.analysis.title).toBe(a7.analysis!.title); // flagged, never rewritten
    const labels = result.analysis.flags.map((flag) => flag.label);
    expect(labels).toContain(DATE_CHECK_LABEL);
    expect(labels).toContain(DOSE_CHECK_FLAG.label);
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
