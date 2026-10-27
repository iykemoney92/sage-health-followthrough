import { describe, expect, it } from "vitest";
import { decodeEob, emptyFigures, formatCents, hasEnough, parseDollars, parseEobText, type EobFigures } from "@/lib/tools/eob-decoder";

function figures(values: Partial<Record<keyof EobFigures, number>>): EobFigures {
  const out = emptyFigures();
  for (const [key, dollars] of Object.entries(values)) out[key as keyof EobFigures] = Math.round(dollars * 100);
  return out;
}

const titles = (list: { title: string }[]) => list.map((item) => item.title);

describe("parseDollars", () => {
  it("reads the ways money is typed and printed", () => {
    expect(parseDollars("$1,234.56")).toBe(123456);
    expect(parseDollars("40")).toBe(4000);
    expect(parseDollars("12.5")).toBe(1250);
    expect(parseDollars("(40.00)")).toBe(-4000);
    expect(parseDollars("")).toBeNull();
    expect(parseDollars("abc")).toBeNaN();
    expect(parseDollars("1.234")).toBeNaN();
  });
  it("formats cents back to dollars", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(4000)).toBe("$40.00");
  });
});

describe("decodeEob", () => {
  it("in-network visit where everything adds up and the bill matches", () => {
    // The clinic example on /guides/eob-vs-medical-bill.
    const result = decodeEob({ figures: figures({ billed: 310, allowed: 180, planPaid: 140, copay: 40, eobOwe: 40, bill: 40 }), network: "in", setting: "other" });
    expect(result.patientResponsibility).toBe(4000);
    expect(titles(result.checks)).toContain("The figures add up");
    expect(titles(result.checks)).toContain("Your share matches the EOB’s total");
    expect(result.bill.verdict).toBe("match");
  });

  it("deductible plus coinsurance, worked out like the MRI example", () => {
    const result = decodeEob({ figures: figures({ billed: 2400, allowed: 900, planPaid: 320, deductible: 500, coinsurance: 80 }), network: "in", setting: "other" });
    expect(result.patientResponsibility).toBe(58000);
    expect(titles(result.checks)).toContain("The figures add up");
    expect(titles(result.checks)).toContain("Coinsurance is about 20% of what was left");
    expect(result.bill.verdict).toBe("none");
  });

  it("flags figures that don't add up", () => {
    const result = decodeEob({ figures: figures({ allowed: 250, planPaid: 120, deductible: 100, coinsurance: 20 }), network: "in", setting: "other" });
    const check = result.checks.find((c) => c.title === "The figures don’t add up");
    expect(check?.detail).toContain("$10.00 short");
  });

  it("flags a printed total that differs from the parts", () => {
    const result = decodeEob({ figures: figures({ deductible: 100, coinsurance: 30, eobOwe: 150 }), network: "in", setting: "other" });
    expect(titles(result.checks)).toContain("Your share doesn’t match the EOB’s total");
    expect(result.compareWith).toBe(15000);
  });

  it("accepts not-covered amounts counted inside the allowed amount", () => {
    const result = decodeEob({ figures: figures({ allowed: 300, planPaid: 200, copay: 50, notCovered: 50 }), network: "in", setting: "other" });
    expect(titles(result.checks)).toContain("The figures add up");
    expect(result.patientResponsibility).toBe(10000);
  });

  it("mismatch: bill asks for the billed-minus-allowed gap on top (balance billing), in-network", () => {
    const result = decodeEob({ figures: figures({ billed: 310, allowed: 180, planPaid: 140, copay: 40, bill: 170 }), network: "in", setting: "other" });
    expect(result.bill.verdict).toBe("higher");
    expect(result.bill.difference).toBe(13000);
    const found = titles(result.bill.findings);
    expect(found).toContain("The extra equals the gap between billed and allowed");
    expect(found).toContain("The bill asks for $130.00 more than the EOB says you owe");
    expect(found).toContain("In-network provider");
    expect(found).not.toContain("The No Surprises Act may apply");
  });

  it("mismatch: out-of-network ER bill points to the No Surprises Act", () => {
    const result = decodeEob({ figures: figures({ billed: 1800, allowed: 900, planPaid: 600, deductible: 200, coinsurance: 100, bill: 1200 }), network: "out", setting: "emergency" });
    const nsa = result.bill.findings.find((f) => f.title === "The No Surprises Act may apply");
    expect(nsa?.detail).toContain("emergency room care");
    expect(nsa?.detail).toContain("1-800-985-3059");
  });

  it("bill for the full charge looks like insurance was not applied", () => {
    const result = decodeEob({ figures: figures({ billed: 310, allowed: 180, planPaid: 140, copay: 40, bill: 310 }), network: "unsure", setting: "other" });
    expect(titles(result.bill.findings)).toContain("The bill asks for the full charge");
  });

  it("extra equal to the plan payment suggests it isn't credited yet", () => {
    const result = decodeEob({ figures: figures({ billed: 400, allowed: 250, planPaid: 120, deductible: 100, coinsurance: 30, bill: 250 }), network: "in", setting: "other" });
    expect(titles(result.bill.findings)).toContain("The extra equals what the plan paid");
  });

  it("ground ambulance gets the CMS exception, not the protection", () => {
    const result = decodeEob({ figures: figures({ allowed: 500, planPaid: 400, coinsurance: 100, bill: 900 }), network: "out", setting: "ground-ambulance" });
    const found = titles(result.bill.findings);
    expect(found).toContain("Ground ambulance bills");
    expect(found).not.toContain("The No Surprises Act may apply");
  });

  it("a lower bill is explained, not flagged", () => {
    const result = decodeEob({ figures: figures({ copay: 40, bill: 0 }), network: "in", setting: "other" });
    expect(result.bill.verdict).toBe("lower");
  });

  it("uses allowed minus plan paid when no parts are entered", () => {
    const result = decodeEob({ figures: figures({ allowed: 180, planPaid: 140, bill: 40 }), network: "in", setting: "other" });
    expect(result.patientResponsibility).toBeNull();
    expect(result.compareWith).toBe(4000);
    expect(result.bill.verdict).toBe("match");
  });

  it("needs some figures before it decodes", () => {
    expect(hasEnough(emptyFigures())).toBe(false);
    expect(hasEnough(figures({ billed: 100 }))).toBe(false);
    expect(hasEnough(figures({ copay: 20 }))).toBe(true);
  });
});

describe("parseEobText", () => {
  it("picks labelled figures out of pasted EOB text", () => {
    const text = [
      "Claim number 2026-1234567  Date of service 09/14/2026",
      "Amount billed: $2,400.00",
      "Plan allowance $900.00",
      "Applied to deductible  $500.00",
      "Copay $0.00",
      "Coinsurance (20%) $80.00",
      "Paid by plan $320.00",
      "Amount not covered $0.00",
      "Patient responsibility $580.00",
    ].join("\n");
    const { figures, found } = parseEobText(text);
    expect(figures).toEqual({ billed: 240000, allowed: 90000, planPaid: 32000, deductible: 50000, copay: 0, coinsurance: 8000, notCovered: 0, eobOwe: 58000 });
    expect(found).toHaveLength(8);
  });

  it("reads several labels on one line and ignores bare numbers", () => {
    const { figures } = parseEobText("Billed $310.00 Allowed $180.00 Plan paid $140.00 You may owe $40.00\nMember ID 123456789");
    expect(figures).toEqual({ billed: 31000, allowed: 18000, planPaid: 14000, eobOwe: 4000 });
  });

  it("finds nothing in text without labelled money", () => {
    expect(parseEobText("This is not a bill. Claim 12345.").found).toHaveLength(0);
  });
});
