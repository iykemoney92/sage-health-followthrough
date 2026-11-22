import { describe, expect, it } from "vitest";
import { detectDateOrder, findDates, findUnsupportedDates } from "./clariti-dates";

describe("findDates", () => {
  it("reads numeric, written and ISO dates, with both readings when a numeric date is ambiguous", () => {
    const dates = findDates("Seen 02/12/2026, booked Wednesday 2 December 2026, sent Nov 12, 2026, logged 2026-11-20.", "either");
    expect(dates.map((date) => date.text)).toEqual(["2026-11-20", "02/12/2026", "2 December 2026", "Nov 12, 2026"]);
    expect(dates.find((date) => date.text === "02/12/2026")?.readings).toEqual([
      { day: 2, month: 12, year: 2026 },
      { day: 12, month: 2, year: 2026 },
    ]);
  });

  it("does not take doses, ranges or blood pressures for dates", () => {
    expect(findDates("Ramipril 2.5mg, INR 2.0 - 3.0, BP 120/80, recheck in 6-8 weeks", "dmy")).toEqual([]);
  });

  it("reads a rough scan's date only when asked to", () => {
    expect(findDates("Date: l2/ll/2026", "dmy")).toEqual([]);
    expect(findDates("Date: l2/ll/2026", "dmy", { scanned: true })[0].primary).toEqual({ day: 12, month: 11, year: 2026 });
  });

  it("keeps a date at the end of a sentence", () => {
    expect(findDates("Stop omeprazole from 18/11/2026.", "dmy").map((date) => date.text)).toEqual(["18/11/2026"]);
  });
});

describe("detectDateOrder", () => {
  it("reads an NHS letter day/month", () => {
    expect(detectDateOrder("North Tees and Hartlepool NHS Foundation Trust\nNext INR test: Tuesday 03/11/2026", "US")).toBe("dmy");
  });

  it("lets a date like 25/10/2026 settle it outright", () => {
    expect(detectDateOrder("Seen 25/10/2026, review 03/11/2026")).toBe("dmy");
    expect(detectDateOrder("Seen 10/25/2026, review 11/03/2026")).toBe("mdy");
  });

  it("reads clearly American paperwork month/day", () => {
    expect(detectDateOrder("EXPLANATION OF BENEFITS\nNorthside Health, Columbus OH 43215\nDate of service 03/11/2026\nPatient responsibility $120.00")).toBe("mdy");
  });

  it("calls it a toss-up for a US reader when the document says nothing, and day/month for everyone else", () => {
    expect(detectDateOrder("Appointment 03/11/2026", "US")).toBe("either");
    expect(detectDateOrder("Appointment 03/11/2026", "GB")).toBe("dmy");
    expect(detectDateOrder("Appointment 03/11/2026", "DE")).toBe("dmy");
    expect(detectDateOrder("Appointment 03/11/2026", null)).toBe("dmy");
  });
});

describe("findUnsupportedDates", () => {
  // The 20 Nov eval failure: "l2/ll/2026" (12 Nov) came back as "11 Dec 2026".
  const scanned = "Ch0rlton Fami1y Practice\nMedicat1on Review   Date: l2/ll/2026\nP1an: B1ood pressure recheck w1th practice nurse 1n 4 weeks.";

  it("flags a day/month date read as month/day", () => {
    expect(findUnsupportedDates("Medication Review — 11 Dec 2026, Chorlton Family Practice", [scanned], "dmy")).toEqual(["11 Dec 2026"]);
  });

  it("passes the right reading, and the date copied as printed", () => {
    expect(findUnsupportedDates("Medication Review — 12 Nov 2026", [scanned], "dmy")).toEqual([]);
    expect(findUnsupportedDates("Your review is dated l2/ll/2026 on this copy.", [scanned], "dmy")).toEqual([]);
    expect(findUnsupportedDates("Reviewed 12 November", [scanned], "dmy")).toEqual([]);
  });

  it("flags a date that is nowhere in the document", () => {
    expect(findUnsupportedDates("Come back on 3 January 2027.", ["Appointment: Wednesday 2 December 2026"], "dmy")).toEqual(["3 January 2027"]);
  });

  it("accepts both readings when the order cannot be told, and the both-readings answer when it can", () => {
    const letter = "Appointment 02/12/2026";
    expect(findUnsupportedDates("That is 12 February 2026.", [letter], "either")).toEqual([]);
    expect(findUnsupportedDates("That is 12 February 2026.", [letter], "dmy")).toEqual(["12 February 2026"]);
    expect(findUnsupportedDates("02/12/2026 could be 2 December 2026 or 12 February 2026 — check this date.", [letter], "dmy")).toEqual([]);
  });

  it("checks nothing when there is no source text to check against", () => {
    expect(findUnsupportedDates("11 Dec 2026", [""], "dmy")).toEqual([]);
  });
});
