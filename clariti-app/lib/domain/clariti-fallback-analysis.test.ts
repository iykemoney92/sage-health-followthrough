import { describe, expect, it } from "vitest";
import { inferClaritiKind, looksLikeTypedQuestion } from "./clariti-fallback-analysis";

// Invented wording. The real 11 Nov input is not copied here.
const typedQuestion = "I have a small red bump on my arm that appeared two days ago, should I be worried about it?";

describe("inferClaritiKind for typed text", () => {
  it("files a typed question as 'unknown', not as the home screen's default medical bill", () => {
    expect(inferClaritiKind({ kind: "medical_bill", question: typedQuestion, documentText: typedQuestion })).toBe("unknown");
    expect(inferClaritiKind({ kind: "medical_bill", question: "Can you explain this?", documentText: "why does my knee hurt when I walk upstairs" })).toBe("unknown");
  });

  it("still files a typed question that is clearly about a bill or a lab result by what it is about", () => {
    expect(inferClaritiKind({ kind: "medical_bill", question: "help", documentText: "Why does my medical bill have a facility fee and an amount due when my insurer paid?" })).toBe("medical_bill");
    expect(inferClaritiKind({ kind: "medical_bill", question: "help", documentText: "my blood test says my cholesterol is high, is that bad?" })).toBe("lab_results");
  });

  it("leaves short real paperwork with its kind", () => {
    const shortBill = "Northside Clinic\nStatement date: 18/07/2026\nOffice visit 99213   $180.00\nBalance: $45.00";
    expect(inferClaritiKind({ kind: "medical_bill", question: "What do I owe?", documentText: shortBill })).toBe("medical_bill");
    const shortLetter = "Patient: Jane Example\nNHS No: 000 000 0000\nPlease attend clinic on 02/12/2026 at 09:30.";
    expect(looksLikeTypedQuestion({ question: "What is this?", documentText: shortLetter })).toBe(false);
  });
});

describe("looksLikeTypedQuestion", () => {
  it("is narrow: long text, labelled fields and many lines are paperwork", () => {
    expect(looksLikeTypedQuestion({ question: "", documentText: typedQuestion })).toBe(true);
    expect(looksLikeTypedQuestion({ question: "", documentText: `${typedQuestion} `.repeat(8) })).toBe(false);
    expect(looksLikeTypedQuestion({ question: "", documentText: "Name: A\nDate: B\nI have a question?" })).toBe(false);
    expect(looksLikeTypedQuestion({ question: "", documentText: "Findings\nImpression\nNormal\nStudy\nOne\nTwo\nThree" })).toBe(false);
  });
});
