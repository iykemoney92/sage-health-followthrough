"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { track } from "@/lib/analytics";
import {
  DAYS,
  EMPTY_SCHEDULE,
  LIMITS,
  STORAGE_KEY,
  TIME_SLOTS,
  chartColumns,
  chartGroups,
  cleanMedicine,
  describeDays,
  describeTimes,
  isValidTime,
  parseSaved,
  validateMedicine,
  type DayId,
  type MedicineDraft,
  type Schedule,
  type TimeSlot,
} from "@/lib/tools/medicine-schedule";

const TOOL = "medicine-schedule";
const ALL_DAYS = DAYS.map((d) => d.id);
const WEEKDAYS: DayId[] = ["mon", "tue", "wed", "thu", "fri"];
const EMPTY_DRAFT: MedicineDraft = { name: "", dose: "", slots: [], times: [], days: ALL_DAYS, note: "" };
/** Rows on a chart with no medicines yet, so it can be printed blank and filled in by hand. */
const BLANK_CHART_ROWS = 8;

function newId() {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * The medicine schedule maker. Everything stays in this browser: the only storage is an optional
 * copy in localStorage (try/catch, because private windows and blocked storage throw), and the
 * analytics events carry the tool name only, never what was typed.
 */
export function ScheduleMaker() {
  const [schedule, setSchedule] = useState<Schedule>(EMPTY_SCHEDULE);
  const [draft, setDraft] = useState<MedicineDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [timeInput, setTimeInput] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [remember, setRemember] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const usedTracked = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Saved schedules only exist in the browser, so they load after the first render.
  useEffect(() => {
    let saved: Schedule | null = null;
    try {
      saved = parseSaved(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      saved = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setSchedule(saved);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (remember) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked or full: the chart still works for this visit.
    }
  }, [schedule, remember, loaded]);

  function update(patch: Partial<Schedule>) {
    setSchedule((current) => ({ ...current, ...patch }));
  }

  function toggleSlot(slot: TimeSlot) {
    setDraft((d) => ({ ...d, slots: d.slots.includes(slot) ? d.slots.filter((s) => s !== slot) : [...d.slots, slot] }));
  }

  function toggleDay(day: DayId) {
    setDraft((d) => ({ ...d, days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day] }));
  }

  function addTime() {
    if (!isValidTime(timeInput)) {
      setErrors(["Enter a time with hours and minutes, like 08:00."]);
      return;
    }
    if (draft.times.length >= LIMITS.timesPerMedicine) {
      setErrors([`Up to ${LIMITS.timesPerMedicine} set times per medicine.`]);
      return;
    }
    setDraft((d) => ({ ...d, times: [...new Set([...d.times, timeInput])].sort() }));
    setTimeInput("");
    setErrors([]);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    // A time typed but not yet added with "Add time" still counts.
    const times = isValidTime(timeInput) ? [...new Set([...draft.times, timeInput])] : draft.times;
    const candidate = { ...draft, times };
    const problems = validateMedicine(candidate);
    if (!editingId && schedule.medicines.length >= LIMITS.medicines) {
      problems.push(`The chart holds up to ${LIMITS.medicines} medicines.`);
    }
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    const medicine = cleanMedicine(candidate, editingId ?? newId());
    setSchedule((current) => ({
      ...current,
      medicines: editingId
        ? current.medicines.map((m) => (m.id === editingId ? medicine : m))
        : [...current.medicines, medicine],
    }));
    setStatus(editingId ? `${medicine.name} updated.` : `${medicine.name} added to the chart.`);
    setDraft(EMPTY_DRAFT);
    setTimeInput("");
    setEditingId(null);
    setErrors([]);
    if (!usedTracked.current) {
      usedTracked.current = true;
      track("tool_used", { tool: TOOL, action: "chart" });
    }
    nameRef.current?.focus();
  }

  function edit(id: string) {
    const medicine = schedule.medicines.find((m) => m.id === id);
    if (!medicine) return;
    setDraft({
      name: medicine.name,
      dose: medicine.dose,
      slots: medicine.slots,
      times: medicine.times,
      days: medicine.days,
      note: medicine.note,
    });
    setEditingId(id);
    setErrors([]);
    nameRef.current?.focus();
  }

  function cancelEdit() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setErrors([]);
  }

  function remove(id: string) {
    const medicine = schedule.medicines.find((m) => m.id === id);
    update({ medicines: schedule.medicines.filter((m) => m.id !== id) });
    if (editingId === id) cancelEdit();
    if (medicine) setStatus(`${medicine.name} removed.`);
  }

  function clearAll() {
    if (schedule.medicines.length > 0 && !window.confirm("Clear every medicine and setting from this chart?")) return;
    setSchedule(EMPTY_SCHEDULE);
    cancelEdit();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing saved, or storage blocked.
    }
    setStatus("Chart cleared.");
  }

  function print() {
    track("tool_used", { tool: TOOL, action: "print", medicines: schedule.medicines.length });
    window.print();
  }

  const columns = chartColumns(schedule);
  const groups = chartGroups(schedule);
  const blankRows = schedule.medicines.length === 0 ? BLANK_CHART_ROWS : schedule.blankRows;
  const title = schedule.forName.trim() || "Medicine schedule";

  return (
    <div className="med-tool">
      {/* Paper size for the print dialog. Only this page loads it. */}
      <style>{`@page { size: ${schedule.paper === "letter" ? "letter" : "A4"} ${schedule.orientation}; margin: 12mm; }`}</style>

      <div className="med-panel">
        <label className="med-field">
          <span>Who is the chart for? (optional)</span>
          <input
            type="text"
            value={schedule.forName}
            maxLength={LIMITS.forName}
            placeholder="e.g. Mum's medicines"
            onChange={(e) => update({ forName: e.target.value })}
          />
        </label>

        <form className="med-form" onSubmit={submit} noValidate aria-labelledby="med-form-heading">
          <h2 id="med-form-heading">{editingId ? "Edit medicine" : "Add a medicine"}</h2>
          <div className="med-row">
            <label className="med-field">
              <span>Medicine name</span>
              <input
                ref={nameRef}
                type="text"
                value={draft.name}
                maxLength={LIMITS.name}
                required
                placeholder="As it's written on the label"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="med-field">
              <span>Dose (optional)</span>
              <input
                type="text"
                value={draft.dose}
                maxLength={LIMITS.dose}
                placeholder="e.g. 1 tablet, 2 puffs"
                onChange={(e) => setDraft({ ...draft, dose: e.target.value })}
              />
            </label>
          </div>

          <fieldset className="med-fieldset">
            <legend>When it&apos;s taken</legend>
            <div className="med-chips">
              {TIME_SLOTS.map((slot) => (
                <label key={slot.id} className="med-chip">
                  <input type="checkbox" checked={draft.slots.includes(slot.id)} onChange={() => toggleSlot(slot.id)} />
                  <span>{slot.label}</span>
                </label>
              ))}
            </div>
            <div className="med-time-add">
              <label className="med-field">
                <span>Or a set time</span>
                <input type="time" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} />
              </label>
              <button type="button" className="med-secondary" onClick={addTime}>
                <Plus size={15} aria-hidden="true" /> Add time
              </button>
            </div>
            {draft.times.length > 0 && (
              <ul className="med-time-list" aria-label="Set times">
                {draft.times.map((time) => (
                  <li key={time}>
                    {describeTimes({ slots: [], times: [time] })}
                    <button
                      type="button"
                      aria-label={`Remove ${describeTimes({ slots: [], times: [time] })}`}
                      onClick={() => setDraft({ ...draft, times: draft.times.filter((t) => t !== time) })}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>

          <fieldset className="med-fieldset">
            <legend>Which days</legend>
            <div className="med-chips">
              {DAYS.map((day) => (
                <label key={day.id} className="med-chip med-chip-day">
                  <input
                    type="checkbox"
                    checked={draft.days.includes(day.id)}
                    onChange={() => toggleDay(day.id)}
                    aria-label={day.label}
                  />
                  <span aria-hidden="true">{day.short}</span>
                </label>
              ))}
            </div>
            <div className="med-quick">
              <button type="button" onClick={() => setDraft({ ...draft, days: ALL_DAYS })}>
                Every day
              </button>
              <button type="button" onClick={() => setDraft({ ...draft, days: WEEKDAYS })}>
                Weekdays
              </button>
              <button type="button" onClick={() => setDraft({ ...draft, days: [] })}>
                None
              </button>
            </div>
          </fieldset>

          <label className="med-field">
            <span>Note (optional)</span>
            <input
              type="text"
              value={draft.note}
              maxLength={LIMITS.note}
              placeholder="e.g. with food, from the label"
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </label>

          {errors.length > 0 && (
            <ul className="med-errors" role="alert">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}

          <div className="med-actions">
            <button type="submit" className="guide-button">
              {editingId ? "Save changes" : "Add to chart"}
            </button>
            {editingId && (
              <button type="button" className="med-secondary" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>

        {schedule.medicines.length > 0 && (
          <section className="med-list" aria-labelledby="med-list-heading">
            <h2 id="med-list-heading">On the chart ({schedule.medicines.length})</h2>
            <ul>
              {schedule.medicines.map((m) => (
                <li key={m.id}>
                  <div>
                    <b>{m.name}</b>
                    {m.dose && <span> · {m.dose}</span>}
                    <small>
                      {describeTimes(m)} · {describeDays(m.days)}
                      {m.note && ` · ${m.note}`}
                    </small>
                  </div>
                  <div className="med-list-actions">
                    <button type="button" onClick={() => edit(m.id)} aria-label={`Edit ${m.name}`}>
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => remove(m.id)} aria-label={`Remove ${m.name}`}>
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <fieldset className="med-fieldset med-options">
          <legend>Chart and paper</legend>
          <label className="med-field">
            <span>Week starts</span>
            <select
              value={schedule.firstDay}
              disabled={Boolean(schedule.weekStart)}
              onChange={(e) => update({ firstDay: e.target.value === "sun" ? "sun" : "mon" })}
            >
              <option value="mon">Monday</option>
              <option value="sun">Sunday</option>
            </select>
          </label>
          <label className="med-field">
            <span>Dates from (optional)</span>
            <input type="date" value={schedule.weekStart} onChange={(e) => update({ weekStart: e.target.value })} />
          </label>
          <label className="med-field">
            <span>Paper</span>
            <select value={schedule.paper} onChange={(e) => update({ paper: e.target.value === "letter" ? "letter" : "a4" })}>
              <option value="a4">A4</option>
              <option value="letter">US Letter</option>
            </select>
          </label>
          <label className="med-field">
            <span>Layout</span>
            <select
              value={schedule.orientation}
              onChange={(e) => update({ orientation: e.target.value === "portrait" ? "portrait" : "landscape" })}
            >
              <option value="landscape">Landscape (wide)</option>
              <option value="portrait">Portrait (tall)</option>
            </select>
          </label>
          <label className="med-field">
            <span>Blank rows to fill in</span>
            <select value={schedule.blankRows} onChange={(e) => update({ blankRows: Number(e.target.value) })}>
              {Array.from({ length: LIMITS.blankRows + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <label className="med-remember">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>
            Keep a copy in this browser so it&apos;s here next time. It is saved only on this device and never
            uploaded. Untick on a shared computer.
          </span>
        </label>

        <div className="med-actions">
          <button type="button" className="guide-button" onClick={print}>
            <Printer size={16} aria-hidden="true" /> Print or save as PDF
          </button>
          <button type="button" className="med-secondary" onClick={clearAll}>
            Clear everything
          </button>
        </div>
        <p className="med-status" role="status" aria-live="polite">
          {status}
        </p>
      </div>

      <div className="med-sheet-wrap">
        <p className="med-sheet-label">
          Preview: this is what prints. In the print window, choose &quot;Save as PDF&quot; to keep a copy.
        </p>
        <div className="med-sheet-scroll">
          <section className={`med-sheet med-sheet-${schedule.orientation}`} aria-label="Printable chart">
            <header className="med-sheet-head">
              <h2>{title}</h2>
              <p>
                {columns[0].date
                  ? `Week of ${columns[0].date} to ${columns[6].date}`
                  : "Week of ________________"}
              </p>
            </header>
            <table className="med-table">
              <caption className="med-sr">
                {title}: tick each box when the dose is taken. Shaded boxes are days it is not due.
              </caption>
              <colgroup>
                <col className="med-col-when" />
                <col className="med-col-med" />
                {columns.map((c) => (
                  <col key={c.day} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Medicine and dose</th>
                  {columns.map((c) => (
                    <th scope="col" key={c.day}>
                      {c.heading}
                      {c.date && <small>{c.date}</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.when} className="med-group">
                  {group.rows.map((row, index) => (
                    <tr key={row.key}>
                      {index === 0 && (
                        <th scope="rowgroup" rowSpan={group.rows.length} className="med-when">
                          {group.when}
                        </th>
                      )}
                      <td className="med-name">
                        <b>{row.medicine.name}</b>
                        {row.medicine.dose && <span>{row.medicine.dose}</span>}
                        {row.medicine.note && <em>{row.medicine.note}</em>}
                      </td>
                      {row.due.map((due, i) => (
                        <td key={columns[i].day} className={due ? "med-box" : "med-off"}>
                          {due ? (
                            <span className="med-tick" aria-label={`${columns[i].heading}: tick when taken`} />
                          ) : (
                            <span className="med-sr">{columns[i].heading}: not due</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
              {blankRows > 0 && (
                <tbody className="med-group med-blank">
                  {Array.from({ length: blankRows }, (_, n) => (
                    <tr key={n}>
                      <th scope="row" className="med-when">
                        <span className="med-sr">Blank row {n + 1}</span>
                      </th>
                      <td className="med-name" />
                      {columns.map((c) => (
                        <td key={c.day} className="med-box">
                          <span className="med-tick" aria-hidden="true" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
            <footer className="med-sheet-foot">
              <p>
                This is a personal reminder chart, not medical advice; follow your prescriber or pharmacist. If a dose
                is missed, check the leaflet or ask a pharmacist; don&apos;t take a double dose to make up for it unless
                they tell you to.
              </p>
              <p>Made with the free medicine schedule maker at usenura.app/tools/medicine-schedule</p>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
}
