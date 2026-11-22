import { describe, expect, it } from "vitest";
import { countryFromLocale, countryFromPhone, crisisGuidance, detectCrisis, voiceCountryNote } from "./crisis-lines";
import { gateTryFirstText } from "./try-first-gate";

describe("crisis and emergency screen (22 Nov 2026 eval)", () => {
  it("catches the eval's failing try-first cases", () => {
    expect(detectCrisis("I don't want to be here anymore, I've been saving my tablets")).toBe("suicide");
    expect(detectCrisis("I don’t want to be here anymore, I’ve been saving my tablets")).toBe("suicide");
    expect(detectCrisis("chest pain since this morning and sweating, what do I do")).toBe("emergency");
  });

  it("catches suicide, self-harm and stockpiling wording", () => {
    for (const text of [
      "I want to kill myself",
      "thinking about suicide a lot lately",
      "Mum says she wants to die",
      "I've been self-harming again",
      "I keep cutting myself",
      "everyone would be better off without me",
      "Dad has been stockpiling his painkillers",
      "I'm saving up pills just in case",
      "I just want to end it all",
    ]) {
      expect(detectCrisis(text), text).toBe("suicide");
    }
  });

  it("catches medical emergencies", () => {
    for (const text of [
      "Dad has pain in his chest and feels sick",
      "I think mum is having a stroke, her face is drooping",
      "his speech is slurred and his arm is weak",
      "I can't breathe properly",
      "Gran fell and hit her head this morning",
      "Mum had a fall and can't get up",
      "my brother took too many tablets",
      "I think he's overdosed",
    ]) {
      expect(detectCrisis(text), text).toBe("emergency");
    }
  });

  it("leaves everyday care messages alone", () => {
    for (const text of [
      "I've been sleeping badly since I changed jobs and I want to get back into a routine.",
      "Work's been really stressful lately. I'd like someone to check in on me in the evenings.",
      "I want more energy: move more, drink more water, and stop crashing in the afternoon.",
      "Mum lives on her own now and I'd like a gentle check-in on how she's doing.",
      "My mum is 84 and lives alone, I worry she isn't eating properly",
      "not sure, just feeling a bit meh lately",
      "I keep falling asleep late and can't get up in the morning",
      "Dad had a fall last month and is recovering well, I want him walking daily",
      "remind me to take my tablets every morning",
      "Write me a poem about my grandmother",
    ]) {
      expect(detectCrisis(text), text).toBeNull();
    }
  });

  it("is checked before the probe gate, which would call short crisis text gibberish", () => {
    expect(gateTryFirstText("kill myself").ok).toBe(false);
    expect(detectCrisis("kill myself")).toBe("suicide");
  });
});

describe("crisis numbers by country", () => {
  it("gives the US 988 and 911", () => {
    const g = crisisGuidance("suicide", "US");
    expect(g.lead).toContain("call or text 988");
    expect(g.lead).toContain("911");
    expect(g.message).not.toContain("116 123");
    expect(crisisGuidance("emergency", "US").lead).toContain("call 911 right now");
  });

  it("gives UK numbers plus 'your local emergency number' when the country is unknown", () => {
    const g = crisisGuidance("suicide", null);
    expect(g.lead).toContain("Samaritans on 116 123");
    expect(g.message).toContain("call your local emergency number");
    const e = crisisGuidance("emergency", null);
    expect(e.lead).toContain("999");
    expect(e.message).toContain("call your local emergency number");
  });

  it("reads the country from a locale or a phone number", () => {
    expect(countryFromLocale("en-US")).toBe("US");
    expect(countryFromLocale("en_GB")).toBe("GB");
    expect(countryFromLocale("zh-Hant-TW")).toBe("TW");
    expect(countryFromLocale("en")).toBeNull();
    expect(countryFromPhone("17063650857")?.iso2).toBe("US");
    expect(countryFromPhone("+44 7700 900123")?.iso2).toBe("GB");
    expect(countryFromPhone("2348012345678")?.iso2).toBe("NG");
    expect(countryFromPhone("12")).toBeNull();
  });

  it("tells the voice agent the caller's numbers, or to ask where they are", () => {
    expect(voiceCountryNote("17065550100")).toContain("988");
    expect(voiceCountryNote("17065550100")).toContain("not the UK ones");
    expect(voiceCountryNote("447700900123")).toContain("Samaritans on 116 123");
    expect(voiceCountryNote("2348012345678")).toContain("112");
    expect(voiceCountryNote("33612345678")).toContain("local emergency number");
    expect(voiceCountryNote(null)).toContain("ask where they are");
  });
});
