import { describe, expect, it } from "vitest";
import type { ClaritiAnalysis, ClaritiAnalysisKind } from "@/lib/ai/clariti-analysis";
import {
  scoreThreadRelatedness,
  suggestThreadLinks,
  type Thread,
  type ThreadDocument,
} from "@/lib/domain/clariti-threads";

/**
 * Threading decides what the agent reads together, so a wrong link is not a
 * cosmetic miss: it makes Clariti reason across documents that are not about the
 * same thing and state relationships that do not exist.
 *
 * Every case here is a way that happens. The old comparison matched on
 * `analysis.kind`, which put a thyroid panel and a diabetes panel side by side
 * as though they measured the same thing, and could never put a bill next to its
 * own EOB. The traps below are the ones that replace it: two documents that are
 * only the same person's, only the same week's, only the same type — and a
 * number both pages happen to print for unrelated reasons.
 *
 * Two of them are failures this scorer actually shipped with: a pile of weak
 * signals standing in for a second real one, and a body part read out of the
 * safety advice Clariti writes itself rather than out of the document.
 */

type DocumentInput = {
  id?: string;
  kind?: ClaritiAnalysisKind;
  title?: string;
  createdAt?: string;
  summary?: string;
  anchors?: string[];
  metrics?: ClaritiAnalysis["metrics"];
  /** Clariti's own prose about the document, as opposed to `anchors`, which are the document's. */
  keyPoints?: ClaritiAnalysis["keyPoints"];
  flags?: ClaritiAnalysis["flags"];
};

function doc(input: DocumentInput = {}): ThreadDocument {
  return {
    id: input.id ?? "doc-1",
    kind: input.kind ?? "unknown",
    title: input.title ?? "A document",
    createdAt: input.createdAt ?? "2026-03-01T09:00:00.000Z",
    analysis: {
      summary: input.summary ?? "A saved document.",
      sourceAnchors: input.anchors ?? [],
      keyPoints: input.keyPoints ?? [],
      metrics: input.metrics ?? [],
      flags: input.flags ?? [],
    },
  };
}

const reasonsOf = (result: ReturnType<typeof scoreThreadRelatedness>) =>
  (result.verdict === "related" ? result.reasons : result.weakSignals).join(" | ");

const signalsOf = (result: ReturnType<typeof scoreThreadRelatedness>) => result.evidence.map((item) => item.signal);

const bill = doc({
  id: "bill",
  kind: "medical_bill",
  title: "Hospital bill, 12 March",
  createdAt: "2026-03-12T09:00:00.000Z",
  summary: "A bill from the hospital for your visit.",
  anchors: ["Claim number 4471-002", "Amount due $310.00"],
  metrics: [{ label: "Amount due", value: "$310.00" }],
});

const eob = doc({
  id: "eob",
  kind: "insurance_eob",
  title: "Explanation of Benefits, 20 March",
  createdAt: "2026-03-20T09:00:00.000Z",
  summary: "How your insurer handled the claim.",
  anchors: ["Claim #: 4471-002", "Patient responsibility $310.00"],
  metrics: [{ label: "Patient responsibility", value: "$310.00" }],
});

const marchKnee = doc({
  id: "knee-march",
  kind: "radiology_report",
  title: "Knee X-ray, March",
  createdAt: "2026-03-02T09:00:00.000Z",
  summary: "An X-ray of your left knee.",
  anchors: ["mild narrowing of the left knee joint space"],
});

const julyKnee = doc({
  id: "knee-july",
  kind: "radiology_report",
  title: "Knee MRI, July",
  createdAt: "2026-07-14T09:00:00.000Z",
  summary: "An MRI scan of your left knee.",
  anchors: ["a small tear in the left knee meniscus"],
});

describe("thread relatedness", () => {
  it("links a bill to its own EOB on the claim number they share", () => {
    const result = scoreThreadRelatedness(bill, eob);

    expect(result.verdict).toBe("related");
    expect(signalsOf(result)).toContain("episode_identifier");
    expect(reasonsOf(result)).toMatch(/claim number/i);
    expect(reasonsOf(result)).toContain("4471-002");
    // The most valuable comparison the product can offer, and the old
    // kind-matching finder could never reach it: a bill and an EOB are
    // different kinds by definition.
    expect(result.score).toBeGreaterThanOrEqual(0.6);
  });

  it("will not link two lab panels that measure different things", () => {
    const thyroid = doc({
      id: "thyroid",
      kind: "lab_results",
      title: "Thyroid panel",
      createdAt: "2026-04-02T09:00:00.000Z",
      summary: "A blood test of how your thyroid is working.",
      metrics: [
        { label: "TSH", value: "3.1 mIU/L" },
        { label: "Free T4", value: "14 pmol/L" },
      ],
    });
    const diabetes = doc({
      id: "diabetes",
      kind: "lab_results",
      title: "Diabetes panel",
      createdAt: "2026-04-12T09:00:00.000Z",
      summary: "A blood test of your blood sugar control.",
      metrics: [
        { label: "HbA1c", value: "52 mmol/mol" },
        { label: "Fasting glucose", value: "6.8 mmol/L" },
      ],
    });

    const result = scoreThreadRelatedness(thyroid, diabetes);

    // Same kind, same fortnight, same person — which is exactly what the old
    // finder called a match.
    expect(result.verdict).toBe("unsure");
    expect(signalsOf(result)).not.toContain("shared_metrics");
    expect(signalsOf(result)).not.toContain("anatomy");
    expect(result.verdict === "unsure" && result.whyNot).toMatch(/all of your paperwork/i);
  });

  it("links two scans of the same knee taken months apart", () => {
    const result = scoreThreadRelatedness(julyKnee, marchKnee);

    expect(result.verdict).toBe("related");
    expect(signalsOf(result)).toContain("anatomy");
    expect(reasonsOf(result)).toMatch(/knee/i);
    // Four months apart, so nothing about the calendar is holding this up.
    expect(signalsOf(result)).not.toContain("close_in_time");
  });

  it("does not link a left knee to a right knee", () => {
    const rightKnee = doc({
      id: "knee-right",
      kind: "radiology_report",
      title: "Knee X-ray, August",
      createdAt: "2026-08-02T09:00:00.000Z",
      summary: "An X-ray of your right knee.",
      anchors: ["no abnormality of the right knee"],
    });

    const result = scoreThreadRelatedness(julyKnee, rightKnee);

    expect(result.verdict).toBe("unsure");
    expect(signalsOf(result)).not.toContain("anatomy");
  });

  it("will not link two specialists' letters on the same person and the same week", () => {
    const dermatology = doc({
      id: "derm",
      kind: "referral_letter",
      title: "Dermatology letter",
      createdAt: "2026-05-04T09:00:00.000Z",
      summary: "A letter about your skin.",
      anchors: ["Dear Ms Adeyemi", "referred to dermatology about a mole"],
    });
    const cardiology = doc({
      id: "cardio",
      kind: "referral_letter",
      title: "Cardiology letter",
      createdAt: "2026-05-07T09:00:00.000Z",
      summary: "A letter about your heart.",
      anchors: ["Dear Ms Adeyemi", "referred to cardiology about chest tightness"],
    });

    const result = scoreThreadRelatedness(dermatology, cardiology);

    expect(result.verdict).toBe("unsure");
    // "Dear Ms Adeyemi" is the patient on both letters. Patients are Ms and Mr;
    // reading a shared name as a shared clinician would make every letter a
    // person ever receives one story.
    expect(signalsOf(result)).not.toContain("clinician");
    expect(signalsOf(result)).not.toContain("anatomy");
    expect(suggestThreadLinks(cardiology, [{ id: "t-derm", title: "Skin", documents: [dermatology] }]).proposals).toEqual([]);
  });

  it("is not fooled by a page count or a year printed on both documents", () => {
    const anonBill = doc({
      id: "bill-2",
      kind: "medical_bill",
      title: "Clinic bill",
      createdAt: "2026-02-01T09:00:00.000Z",
      summary: "A bill for a clinic visit in 2026.",
      anchors: ["Page 1 of 4", "Statement period 2026", "Amount due $88.00"],
      metrics: [{ label: "Amount due", value: "$88.00" }],
    });
    const anonEob = doc({
      id: "eob-2",
      kind: "insurance_eob",
      title: "Insurance statement",
      createdAt: "2026-02-08T09:00:00.000Z",
      summary: "How your insurer handled a claim from 2026.",
      anchors: ["Page 1 of 4", "Statement period 2026", "Patient responsibility $88.00"],
      metrics: [{ label: "Patient responsibility", value: "$88.00" }],
    });

    const result = scoreThreadRelatedness(anonBill, anonEob);

    // Both pages really do print "1", "4" and "2026". None of it is a reference
    // to anything, and an unlabelled number match is how a bill for a knee ends
    // up filed against somebody's skin biopsy.
    expect(signalsOf(result)).not.toContain("episode_identifier");
    expect(result.verdict).toBe("unsure");
  });

  it("treats a shared member number as proof of whose paperwork it is, not of one story", () => {
    const insurerLetter = doc({
      id: "eob-3",
      kind: "insurance_eob",
      title: "Explanation of Benefits, January",
      createdAt: "2026-01-06T09:00:00.000Z",
      summary: "How your insurer handled a claim.",
      anchors: ["Member number 88123456"],
    });
    const scan = doc({
      id: "scan-3",
      kind: "radiology_report",
      title: "Ultrasound report, September",
      createdAt: "2026-09-08T09:00:00.000Z",
      summary: "An ultrasound scan report.",
      anchors: ["Member number 88123456"],
    });

    const result = scoreThreadRelatedness(insurerLetter, scan);

    expect(signalsOf(result)).toContain("person_identifier");
    expect(signalsOf(result)).not.toContain("episode_identifier");
    expect(result.verdict).toBe("unsure");
  });

  it("will not link a thyroid panel to a diabetes panel on the pile every document of one person's shares", () => {
    const thyroid = doc({
      id: "thyroid-repro",
      kind: "lab_results",
      title: "Thyroid panel",
      createdAt: "2026-04-02T09:00:00.000Z",
      summary: "A blood test of how your thyroid is working.",
      anchors: ["Meadowbrook Hospital Laboratory", "Member number 88123456", "Requested by Dr Okafor, GP", "TSH 3.1 mIU/L"],
      metrics: [{ label: "TSH", value: "3.1 mIU/L" }],
    });
    const diabetes = doc({
      id: "diabetes-repro",
      kind: "lab_results",
      title: "Diabetes panel",
      createdAt: "2026-04-12T09:00:00.000Z",
      summary: "A blood test of your blood sugar control.",
      anchors: ["Meadowbrook Hospital Laboratory", "Member number 88123456", "Requested by Dr Okafor, GP", "HbA1c 52 mmol/mol"],
      metrics: [{ label: "HbA1c", value: "52 mmol/mol" }],
    });

    const result = scoreThreadRelatedness(thyroid, diabetes);

    // Everything these two have in common is true of the whole library: the
    // insurer's number for this person, the hospital that does all their bloods,
    // two lab sheets being two lab sheets, one evening of uploading — and the GP
    // who orders all of it. Four weak signals seconding one loose tie is what
    // scored `related` here, which is the exact defect threading exists to remove.
    expect(signalsOf(result)).toEqual(
      expect.arrayContaining(["clinician", "facility", "person_identifier", "kind_pair", "close_in_time"]),
    );
    expect(result.verdict).toBe("unsure");
    expect(result.verdict === "unsure" && result.whyNot).toMatch(/Okafor/);
  });

  it("will not propose on a member number and a kind pair, however often that pair is one claim", () => {
    const januaryBill = doc({
      id: "bill-jan",
      kind: "medical_bill",
      title: "Clinic bill, January",
      createdAt: "2026-01-09T09:00:00.000Z",
      summary: "A bill for a clinic visit.",
      anchors: ["Member number 77400123", "Amount due $45.00"],
      metrics: [{ label: "Amount due", value: "$45.00" }],
    });
    const februaryEob = doc({
      id: "eob-feb",
      kind: "insurance_eob",
      title: "Explanation of Benefits, February",
      createdAt: "2026-02-03T09:00:00.000Z",
      summary: "How your insurer handled a claim.",
      anchors: ["Member number 77400123", "Patient responsibility $120.00"],
      metrics: [{ label: "Patient responsibility", value: "$120.00" }],
    });

    const result = scoreThreadRelatedness(januaryBill, februaryEob);

    // A bill and an EOB usually are two sides of one claim, and this number
    // really is printed on both. Neither fact is about *these* two: the number
    // is on everything the insurer sends, and the claim reference that would
    // have settled it is on neither.
    expect(signalsOf(result)).toEqual(expect.arrayContaining(["person_identifier", "kind_pair"]));
    expect(signalsOf(result)).not.toContain("episode_identifier");
    expect(result.verdict).toBe("unsure");

    const { proposals, unsure } = suggestThreadLinks(februaryEob, [
      { id: "t-jan", title: "Clinic visit, January", documents: [januaryBill] },
    ]);
    expect(proposals).toEqual([]);
    expect(unsure[0].whyNot).toMatch(/all of your paperwork/i);
  });

  it("does not read a body part out of the safety advice Clariti writes itself", () => {
    // The analysis prompt asks the model for red-flag advice, so this sentence
    // lands on documents about anything at all — including a foot.
    const urgentCare = [
      {
        label: "When to get help",
        detail: "If you develop chest pain or shortness of breath, seek urgent care.",
        severity: "urgent" as const,
      },
    ];
    const watchFor = [
      { label: "What to watch for", detail: "Call your doctor if you notice chest pain.", sourceAnchor: "" },
    ];
    const thyroid = doc({
      id: "thyroid-safety",
      kind: "lab_results",
      title: "Thyroid panel",
      createdAt: "2026-06-01T09:00:00.000Z",
      summary: "A blood test of how your thyroid is working. Get help straight away if you have chest pain.",
      anchors: ["TSH 3.1 mIU/L", "Member number 88123456"],
      keyPoints: watchFor,
      flags: urgentCare,
    });
    const foot = doc({
      id: "foot-safety",
      kind: "radiology_report",
      title: "Foot X-ray",
      createdAt: "2026-06-10T09:00:00.000Z",
      summary: "An X-ray of your foot. Get help straight away if you have chest pain.",
      anchors: ["no fracture of the left foot", "Member number 88123456"],
      keyPoints: watchFor,
      flags: urgentCare,
    });

    const result = scoreThreadRelatedness(thyroid, foot);

    // Neither document mentions a chest. Clariti does, in three places, in its
    // own words — and on that a thyroid panel and a foot X-ray came back
    // `related`.
    expect(signalsOf(result)).not.toContain("anatomy");
    expect(result.verdict).toBe("unsure");

    // The signal is untouched; its provenance is what changed. Read from the
    // documents own words, a chest is still a chest.
    const chestXray = doc({ id: "chest", kind: "radiology_report", title: "Chest X-ray", anchors: ["the left lung is clear"] });
    const cardiology = doc({
      id: "cardiology",
      kind: "referral_letter",
      title: "Cardiology clinic letter",
      anchors: ["referred about chest tightness"],
    });

    expect(signalsOf(scoreThreadRelatedness(chestXray, cardiology))).toContain("anatomy");
  });

  it("links two blood tests that report the same marker", () => {
    const january = doc({
      id: "bloods-jan",
      kind: "lab_results",
      title: "Blood test, January",
      createdAt: "2026-01-06T09:00:00.000Z",
      summary: "A blood test.",
      metrics: [
        { label: "Haemoglobin", value: "9.1 g/dL" },
        { label: "Platelets", value: "210" },
      ],
    });
    const may = doc({
      id: "bloods-may",
      kind: "lab_results",
      title: "Blood test, May",
      createdAt: "2026-05-04T09:00:00.000Z",
      summary: "A blood test.",
      metrics: [
        { label: "Hemoglobin", value: "11.4 g/dL" },
        { label: "Ferritin", value: "30 ng/mL" },
      ],
    });

    const result = scoreThreadRelatedness(january, may);

    expect(result.verdict).toBe("related");
    expect(signalsOf(result)).toContain("shared_metrics");
    // Spelt both ways across the Atlantic; it is one test either way.
    expect(reasonsOf(result)).toMatch(/haemoglobin/i);
  });
});

describe("thread link suggestions", () => {
  const billingThread: Thread = { id: "t-billing", title: "Hospital visit, March", documents: [bill] };
  const kneeThread: Thread = { id: "t-knee", title: "Left knee", documents: [marchKnee, julyKnee] };
  const ownThread: Thread = { id: "t-own", title: "This EOB", documents: [eob] };

  it("proposes the billing thread, says why, and names the document it matched", () => {
    const { proposals } = suggestThreadLinks(eob, [kneeThread, billingThread, ownThread]);

    expect(proposals).toHaveLength(1);
    expect(proposals[0].threadId).toBe("t-billing");
    expect(proposals[0].matchedDocument.id).toBe("bill");
    expect(proposals[0].reasons.join(" | ")).toContain("4471-002");
  });

  it("reports the threads it would not propose rather than leaving them out silently", () => {
    const { proposals, unsure } = suggestThreadLinks(eob, [kneeThread, billingThread, ownThread]);

    expect(unsure.map((entry) => entry.threadId)).toEqual(["t-knee"]);
    expect(unsure[0].whyNot.length).toBeGreaterThan(0);
    // The thread the document is already in is neither a proposal nor a doubt.
    expect([...proposals, ...unsure].map((entry) => entry.threadId)).not.toContain("t-own");
  });
});
