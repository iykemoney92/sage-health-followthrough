import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { getGuide } from "@/lib/guides";
import { TOOLS, toolForGuide, toolSignupHref } from "./index";
import {
  EMPTY_SCHEDULE,
  chartColumns,
  chartGroups,
  cleanMedicine,
  describeDays,
  describeTimes,
  formatTime,
  parseSaved,
  validateMedicine,
  type MedicineDraft,
  type Schedule,
} from "./medicine-schedule";

const draft = (over: Partial<MedicineDraft> = {}): MedicineDraft => ({
  name: "Tablet A",
  dose: "1 tablet",
  slots: ["morning"],
  times: [],
  days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
  note: "",
  ...over,
});

describe("tools list", () => {
  it("links each tool from guides that exist", () => {
    for (const tool of TOOLS) {
      expect(tool.guides.length).toBeGreaterThanOrEqual(3);
      for (const slug of tool.guides) {
        expect(getGuide(slug), slug).not.toBeNull();
        expect(toolForGuide(slug)).toBe(tool);
      }
    }
  });

  it("lists every tool in llms.txt and the sitemap", () => {
    const llms = readFileSync(join(__dirname, "../../public/llms.txt"), "utf8");
    const urls = sitemap().map((entry) => entry.url);
    for (const tool of TOOLS) {
      expect(llms, tool.slug).toContain(`https://usenura.app/tools/${tool.slug})`);
      expect(urls).toContain(`https://usenura.app/tools/${tool.slug}`);
    }
  });

  it("tags the call to action for this tool", () => {
    expect(toolSignupHref(TOOLS[0])).toBe(
      "/signup?utm_source=site&utm_medium=web&utm_campaign=nura_nov26&utm_content=tool-medicine-schedule",
    );
  });
});

describe("medicine schedule", () => {
  it("asks for a name, a time and a day", () => {
    expect(validateMedicine(draft())).toEqual([]);
    expect(validateMedicine(draft({ name: "  " }))).toHaveLength(1);
    expect(validateMedicine(draft({ slots: [], times: [] }))).toHaveLength(1);
    expect(validateMedicine(draft({ days: [] }))).toHaveLength(1);
    expect(validateMedicine(draft({ slots: [], times: ["25:00"] }))).toHaveLength(1);
  });

  it("formats set times briefly", () => {
    expect(formatTime("08:00")).toBe("8am");
    expect(formatTime("14:30")).toBe("2:30pm");
    expect(formatTime("00:15")).toBe("12:15am");
    expect(formatTime("12:00")).toBe("12pm");
  });

  it("orders rows through the day and groups medicines taken at the same time", () => {
    const schedule: Schedule = {
      ...EMPTY_SCHEDULE,
      medicines: [
        cleanMedicine(draft({ name: "A", slots: ["bedtime", "morning"] }), "a"),
        cleanMedicine(draft({ name: "B", slots: ["midday"], times: ["07:00"] }), "b"),
        cleanMedicine(draft({ name: "C", slots: ["morning"] }), "c"),
      ],
    };
    const groups = chartGroups(schedule);
    expect(groups.map((g) => g.when)).toEqual(["7am", "Morning", "Midday", "Bedtime"]);
    expect(groups[1].rows.map((r) => r.medicine.name)).toEqual(["A", "C"]);
  });

  it("only puts tick boxes on the chosen days", () => {
    const schedule: Schedule = {
      ...EMPTY_SCHEDULE,
      medicines: [cleanMedicine(draft({ days: ["mon", "sun"] }), "a")],
    };
    expect(chartGroups(schedule)[0].rows[0].due).toEqual([true, false, false, false, false, false, true]);
    const sundayFirst = chartGroups({ ...schedule, firstDay: "sun" });
    expect(sundayFirst[0].rows[0].due).toEqual([true, true, false, false, false, false, false]);
  });

  it("starts the week on the chosen date and shows dates", () => {
    // 4 November 2026 is a Wednesday.
    const columns = chartColumns({ firstDay: "mon", weekStart: "2026-11-04" });
    expect(columns.map((c) => c.heading)).toEqual(["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"]);
    expect(columns[0].date).toBe("4 Nov");
    expect(columns[6].date).toBe("10 Nov");
    expect(chartColumns({ firstDay: "sun", weekStart: "" })[0]).toEqual({ day: "sun", heading: "Sun" });
  });

  it("describes days and times in plain words", () => {
    expect(describeDays(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).toBe("Every day");
    expect(describeDays(["mon", "tue", "wed", "thu", "fri"])).toBe("Weekdays");
    expect(describeDays(["sat", "sun"])).toBe("Weekends");
    expect(describeDays(["mon", "fri", "wed"])).toBe("Mon, Wed, Fri");
    expect(describeTimes({ slots: ["bedtime", "morning"], times: ["14:00"] })).toBe("Morning, Bedtime, 2pm");
  });

  it("cleans and caps what is typed", () => {
    const m = cleanMedicine(draft({ name: `  ${"x".repeat(100)} `, times: ["09:00", "09:00", "bad"] }), "a");
    expect(m.name).toHaveLength(60);
    expect(m.times).toEqual(["09:00"]);
  });

  it("reads back a saved schedule and drops anything malformed", () => {
    const saved = {
      ...EMPTY_SCHEDULE,
      forName: "Mum's medicines",
      paper: "letter",
      blankRows: 99,
      medicines: [
        cleanMedicine(draft(), "a"),
        { name: "", slots: ["morning"], days: ["mon"] },
        { name: "Bad", slots: ["dawn"], times: [], days: ["mon"] },
        "nonsense",
      ],
    };
    const parsed = parseSaved(JSON.stringify(saved))!;
    expect(parsed.forName).toBe("Mum's medicines");
    expect(parsed.paper).toBe("letter");
    expect(parsed.blankRows).toBe(10);
    expect(parsed.medicines.map((m) => m.name)).toEqual(["Tablet A"]);
    expect(parseSaved("{not json")).toBeNull();
    expect(parseSaved(null)).toBeNull();
  });
});
