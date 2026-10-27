/**
 * Printable medicine schedule (/tools/medicine-schedule): the user's own medicines, doses and
 * times laid out as a weekly tick-box chart.
 *
 * Pure functions only, so the page and the tests share them. There is no drug data here on
 * purpose: the chart repeats what the user typed and never suggests a dose, a time or a
 * combination. Times of day ("morning", "bedtime") are labels the user picks; they are never
 * turned into clock times on the chart.
 */

export const TIME_SLOTS = [
  { id: "morning", label: "Morning" },
  { id: "midday", label: "Midday" },
  { id: "evening", label: "Evening" },
  { id: "bedtime", label: "Bedtime" },
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number]["id"];

/** Monday first; the chart can start on Sunday instead. */
export const DAYS = [
  { id: "mon", short: "Mon", label: "Monday" },
  { id: "tue", short: "Tue", label: "Tuesday" },
  { id: "wed", short: "Wed", label: "Wednesday" },
  { id: "thu", short: "Thu", label: "Thursday" },
  { id: "fri", short: "Fri", label: "Friday" },
  { id: "sat", short: "Sat", label: "Saturday" },
  { id: "sun", short: "Sun", label: "Sunday" },
] as const;

export type DayId = (typeof DAYS)[number]["id"];

export type Medicine = {
  id: string;
  name: string;
  /** Free text exactly as on the label, e.g. "1 tablet (5 mg)". Optional. */
  dose: string;
  slots: TimeSlot[];
  /** Set clock times, "HH:MM" (24-hour). */
  times: string[];
  days: DayId[];
  /** Free text, e.g. "with food". Optional. */
  note: string;
};

export type Schedule = {
  /** Optional heading, e.g. "Mum's medicines". */
  forName: string;
  medicines: Medicine[];
  firstDay: "mon" | "sun";
  /** Optional "YYYY-MM-DD"; when set, the columns show dates starting that day. */
  weekStart: string;
  paper: "a4" | "letter";
  orientation: "landscape" | "portrait";
  /** Empty rows at the bottom of the chart for adding things by hand. */
  blankRows: number;
};

export const LIMITS = {
  medicines: 30,
  timesPerMedicine: 6,
  name: 60,
  dose: 40,
  note: 80,
  forName: 50,
  blankRows: 10,
} as const;

export const EMPTY_SCHEDULE: Schedule = {
  forName: "",
  medicines: [],
  firstDay: "mon",
  weekStart: "",
  paper: "a4",
  orientation: "landscape",
  blankRows: 2,
};

const SLOT_IDS = new Set<string>(TIME_SLOTS.map((s) => s.id));
const DAY_IDS = new Set<string>(DAYS.map((d) => d.id));
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Where each time of day sits among set clock times, so a 07:00 row comes before "Midday".
 * Used for ordering rows only: the chart prints "Morning", never a time.
 */
const SLOT_SORT_MINUTES: Record<TimeSlot, number> = {
  morning: 8 * 60,
  midday: 12 * 60,
  evening: 18 * 60,
  bedtime: 22 * 60,
};

export function isValidTime(value: string) {
  return TIME_PATTERN.test(value);
}

function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** "14:30" → "2:30pm"; "08:00" → "8am". Short and unambiguous in both the UK and the US. */
export function formatTime(time: string) {
  if (!isValidTime(time)) return time;
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

export type MedicineDraft = Omit<Medicine, "id">;

/** Problems with a medicine before it goes on the chart, as messages for the form. */
export function validateMedicine(draft: MedicineDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Add the medicine's name.");
  if (draft.slots.length === 0 && draft.times.length === 0) errors.push("Pick at least one time of day or set a time.");
  if (draft.times.some((t) => !isValidTime(t))) errors.push("Times need hours and minutes, like 08:00.");
  if (draft.days.length === 0) errors.push("Pick at least one day.");
  return errors;
}

/** Trims, de-duplicates and orders a draft so the chart is predictable. */
export function cleanMedicine(draft: MedicineDraft, id: string): Medicine {
  return {
    id,
    name: draft.name.trim().slice(0, LIMITS.name),
    dose: draft.dose.trim().slice(0, LIMITS.dose),
    slots: TIME_SLOTS.map((s) => s.id).filter((s) => draft.slots.includes(s)),
    times: [...new Set(draft.times.filter(isValidTime))].sort().slice(0, LIMITS.timesPerMedicine),
    days: DAYS.map((d) => d.id).filter((d) => draft.days.includes(d)),
    note: draft.note.trim().slice(0, LIMITS.note),
  };
}

export type ChartColumn = { day: DayId; heading: string; date?: string };

/** The 7 columns, starting on the chosen first day, or on the weekday of `weekStart` when set. */
export function chartColumns(schedule: Pick<Schedule, "firstDay" | "weekStart">): ChartColumn[] {
  const start = parseDate(schedule.weekStart);
  // getUTCDay: 0 = Sunday. DAYS is Monday-first.
  const startIndex = start ? (start.getUTCDay() + 6) % 7 : schedule.firstDay === "sun" ? 6 : 0;
  return Array.from({ length: 7 }, (_, i) => {
    const day = DAYS[(startIndex + i) % 7];
    if (!start) return { day: day.id, heading: day.short };
    const date = new Date(start.getTime() + i * 86_400_000);
    return {
      day: day.id,
      heading: day.short,
      date: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
    };
  });
}

function parseDate(value: string): Date | null {
  if (!DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type ChartRow = {
  key: string;
  /** "Morning", "Bedtime" or "8:30am". */
  when: string;
  medicine: Medicine;
  /** Whether each column (in chartColumns order) gets a tick box. */
  due: boolean[];
};

export type ChartGroup = { when: string; rows: ChartRow[] };

/**
 * One row per medicine per time it's taken, grouped by time and ordered through the day.
 * Within a time, medicines keep the order the user added them.
 */
export function chartGroups(schedule: Schedule): ChartGroup[] {
  const columns = chartColumns(schedule);
  const entries: { sort: number; when: string; row: ChartRow }[] = [];
  schedule.medicines.forEach((medicine, order) => {
    const due = columns.map((c) => medicine.days.includes(c.day));
    const label = (id: TimeSlot) => TIME_SLOTS.find((s) => s.id === id)!.label;
    for (const slot of medicine.slots) {
      entries.push({
        // Slots sort a hair after a set time at the same minute; `order` keeps entry order.
        sort: SLOT_SORT_MINUTES[slot] * 1000 + 500 + order,
        when: label(slot),
        row: { key: `${medicine.id}-${slot}`, when: label(slot), medicine, due },
      });
    }
    for (const time of medicine.times) {
      entries.push({
        sort: minutes(time) * 1000 + order,
        when: formatTime(time),
        row: { key: `${medicine.id}-${time}`, when: formatTime(time), medicine, due },
      });
    }
  });
  entries.sort((a, b) => a.sort - b.sort);

  const groups: ChartGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last && last.when === entry.when) last.rows.push(entry.row);
    else groups.push({ when: entry.when, rows: [entry.row] });
  }
  return groups;
}

/** "Every day", "Weekdays", "Weekends" or "Mon, Wed, Fri". */
export function describeDays(days: DayId[]) {
  if (days.length === 7) return "Every day";
  const set = new Set(days);
  const weekdays: DayId[] = ["mon", "tue", "wed", "thu", "fri"];
  if (days.length === 5 && weekdays.every((d) => set.has(d))) return "Weekdays";
  if (days.length === 2 && set.has("sat") && set.has("sun")) return "Weekends";
  return DAYS.filter((d) => set.has(d.id))
    .map((d) => d.short)
    .join(", ");
}

/** "Morning, Bedtime, 2pm". */
export function describeTimes(medicine: Pick<Medicine, "slots" | "times">) {
  return [
    ...TIME_SLOTS.filter((s) => medicine.slots.includes(s.id)).map((s) => s.label),
    ...medicine.times.map(formatTime),
  ].join(", ");
}

export const STORAGE_KEY = "nura_medicine_schedule_v1";

function str(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Reads a schedule saved in this browser. Anything malformed is dropped rather than trusted:
 * the value could be from an older version or edited by hand.
 */
export function parseSaved(raw: string | null): Schedule | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const medicines: Medicine[] = [];
  if (Array.isArray(d.medicines)) {
    for (const item of d.medicines.slice(0, LIMITS.medicines)) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;
      const draft: MedicineDraft = {
        name: str(m.name, LIMITS.name),
        dose: str(m.dose, LIMITS.dose),
        slots: Array.isArray(m.slots) ? (m.slots.filter((s) => SLOT_IDS.has(s as string)) as TimeSlot[]) : [],
        times: Array.isArray(m.times) ? m.times.filter((t): t is string => typeof t === "string" && isValidTime(t)) : [],
        days: Array.isArray(m.days) ? (m.days.filter((x) => DAY_IDS.has(x as string)) as DayId[]) : [],
        note: str(m.note, LIMITS.note),
      };
      if (validateMedicine(draft).length > 0) continue;
      medicines.push(cleanMedicine(draft, str(m.id, 40) || `m${medicines.length + 1}`));
    }
  }
  const blankRows = typeof d.blankRows === "number" ? Math.round(d.blankRows) : EMPTY_SCHEDULE.blankRows;
  return {
    forName: str(d.forName, LIMITS.forName),
    medicines,
    firstDay: d.firstDay === "sun" ? "sun" : "mon",
    weekStart: typeof d.weekStart === "string" && parseDate(d.weekStart) ? d.weekStart : "",
    paper: d.paper === "letter" ? "letter" : "a4",
    orientation: d.orientation === "portrait" ? "portrait" : "landscape",
    blankRows: Math.min(Math.max(blankRows, 0), LIMITS.blankRows),
  };
}
