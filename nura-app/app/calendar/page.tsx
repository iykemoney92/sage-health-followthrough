"use client";

import { useEffect, useState } from "react";
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, FileText, MessageCircle, MoreHorizontal, Pill, Plus, Stethoscope, X } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { getAvatarUrl } from "@/lib/avatar";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

const CALENDAR_BUILD = "interactive-calendar-v2";
const hours = ["7 AM","8 AM","9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM","6 PM","7 PM","8 PM"];
const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const shortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const weekdayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

type CalendarTone = "wellbeing" | "health" | "medication" | "appointment" | "stress" | "document" | "sleep";
type CalendarEvent = {
  id: string;
  source: "calendar_event" | "check_in";
  title: string;
  date: string;
  start: string;
  tone: CalendarTone;
  type: string;
  channel: string;
  notes: string;
  planId?: string | null;
};

type RawEvent = Omit<CalendarEvent, "date" | "start"> & { startsAt: string };

// Splits the raw UTC timestamp into the viewer's local date/time - must run client-side
// (the API can't know the browser's timezone), otherwise displayed times drift by the UTC offset.
function withLocalDateTime(event: RawEvent): CalendarEvent {
  const d = new Date(event.startsAt);
  const { startsAt, ...rest } = event;
  void startsAt;
  return {
    ...rest,
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    start: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function formatTime(value: string) {
  const [hourValue, minute] = value.split(":").map(Number);
  const period = hourValue >= 12 ? "PM" : "AM";
  const hour = hourValue % 12 || 12;
  return `${hour}:${String(minute).padStart(2, "0")} ${period}`;
}

function EventToneIcon({ tone }: { tone: CalendarTone }) {
  if (tone === "medication") return <Pill />;
  if (tone === "appointment") return <Stethoscope />;
  if (tone === "document") return <FileText />;
  if (tone === "health") return <CalendarDays />;
  if (tone === "sleep") return <Bell />;
  return <MessageCircle />;
}

function eventRow(event: CalendarEvent) {
  const hour = Number(event.start.split(":")[0]);
  return Math.max(1, Math.min(hours.length, hour - 6));
}

const emptyForm = { title: "", date: "", start: "09:00", channel: "In app", notes: "", eventType: "appointment" };

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"new" | "edit" | null>(null);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState("You");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/calendar-events")
      .then((res) => res.json())
      .then((data) => setEvents(data.ok ? (data.events as RawEvent[]).map(withLocalDateTime) : []))
      .finally(() => setLoading(false));

    fetch("/api/calendar/mark-viewed", { method: "POST" }).catch(() => {});

    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      const displayName = (user.user_metadata?.display_name as string | undefined) || user.email || "You";
      setUserName(displayName);
      setUserAvatarUrl((user.user_metadata?.avatar_url as string | undefined) || getAvatarUrl(displayName));
    });
  }, []);

  const selected = selectedId ? events.find((event) => event.id === selectedId) : undefined;

  function openNewEvent() {
    setForm({ ...emptyForm, date: dateKey(cursor) });
    setModalMode("new");
  }

  function openEditEvent() {
    if (!selected) return;
    if (selected.source !== "calendar_event") {
      setNotice("This item comes from a Thread — reschedule it from the Thread's check-in instead.");
      return;
    }
    setForm({
      title: selected.title,
      date: selected.date,
      start: selected.start,
      channel: selected.channel,
      notes: selected.notes,
      eventType: selected.tone === "medication" ? "medication" : selected.tone === "document" ? "document" : "appointment",
    });
    setModalMode("edit");
  }

  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthGridStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));

  const chronological = (a: CalendarEvent, b: CalendarEvent) =>
    a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date);

  const visibleEvents = (() => {
    if (view === "week") {
      const start = weekStart.getTime();
      const end = addDays(weekStart, 7).getTime();
      return events
        .filter((event) => {
          const time = parseDate(event.date).getTime();
          return time >= start && time < end;
        })
        .sort(chronological);
    }
    return events
      .filter((event) => {
        const eventDate = parseDate(event.date);
        return eventDate.getMonth() === cursor.getMonth() && eventDate.getFullYear() === cursor.getFullYear();
      })
      .sort(chronological);
  })();

  const weekEnd = addDays(weekStart, 6);
  const pageLabel = view === "week"
    ? weekStart.getMonth() === weekEnd.getMonth() && weekStart.getFullYear() === weekEnd.getFullYear()
      ? `${weekStart.getDate()} - ${weekEnd.getDate()} ${shortMonthNames[weekStart.getMonth()]} ${weekStart.getFullYear()}`
      : weekStart.getFullYear() === weekEnd.getFullYear()
        ? `${weekStart.getDate()} ${shortMonthNames[weekStart.getMonth()]} - ${weekEnd.getDate()} ${shortMonthNames[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
        : `${weekStart.getDate()} ${shortMonthNames[weekStart.getMonth()]} ${weekStart.getFullYear()} - ${weekEnd.getDate()} ${shortMonthNames[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
    : `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;

  const move = (direction: -1 | 1) => {
    setCursor((current) => view === "week" ? addDays(current, direction * 7) : new Date(current.getFullYear(), current.getMonth() + direction, 1));
    setNotice("");
  };

  const goToday = () => {
    setCursor(new Date());
    setSelectedId(null);
    setNotice("Calendar returned to this week.");
  };

  async function handleSave() {
    const currentForm = {
      title: (document.getElementById("calendar-title") as HTMLInputElement | null)?.value ?? form.title,
      date: (document.getElementById("calendar-date") as HTMLInputElement | null)?.value ?? form.date,
      start: (document.getElementById("calendar-time") as HTMLInputElement | null)?.value ?? form.start,
      eventType: (document.getElementById("calendar-type") as HTMLSelectElement | null)?.value ?? form.eventType,
      channel: (document.getElementById("calendar-channel") as HTMLSelectElement | null)?.value ?? form.channel,
      notes: (document.getElementById("calendar-notes") as HTMLTextAreaElement | null)?.value ?? form.notes,
    };

    if (!currentForm.title.trim() || !currentForm.date || !currentForm.start) return;
    setSaving(true);
    try {
      if (modalMode === "new") {
        const res = await fetch("/api/calendar-events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentForm),
        });
        const data = await res.json();
        if (data.ok) {
          setEvents((prev) => [...prev, withLocalDateTime(data.event as RawEvent)]);
          setNotice("New event added to your calendar.");
        } else {
          setNotice("Could not add this event. Please check the details and try again.");
        }
      } else if (modalMode === "edit" && selected) {
        if (selected.source !== "calendar_event") {
          setNotice("This item comes from a Thread — reschedule it from the Thread's check-in instead.");
        } else {
          const res = await fetch(`/api/calendar-events/${selected.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentForm),
          });
          const data = await res.json();
          if (data.ok) {
            const updated = withLocalDateTime(data.event as RawEvent);
            setEvents((prev) => prev.map((event) => (event.id === selected.id ? updated : event)));
            setNotice(`${currentForm.title} changes saved.`);
          } else {
            setNotice("Could not save this event. Please try again.");
          }
        }
      }
      setModalMode(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (selected.source !== "calendar_event") {
      setNotice("This item comes from a Thread — manage it from the Thread page instead.");
      return;
    }
    const res = await fetch(`/api/calendar-events/${selected.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setNotice("Could not delete this event. Please try again.");
      return;
    }
    setEvents((prev) => prev.filter((event) => event.id !== selected.id));
    setNotice(`${selected.title} deleted.`);
    setSelectedId(null);
  }

  return <NuraShell userName={userName} userAvatarUrl={userAvatarUrl}><div className="dashboard-page calendar-page interactive-calendar" data-build={CALENDAR_BUILD}>
    <div className="calendar-page-head">
      <div><h1>Calendar</h1></div>
      <div className="calendar-head-actions">
        <button className="secondary-cta calendar-today" onClick={goToday}>Today</button>
        <div className="calendar-view-toggle" role="tablist" aria-label="Calendar view">
          <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button>
          <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Month</button>
        </div>
      </div>
    </div>
    <button className="calendar-floating-add" aria-label="New calendar event" onClick={openNewEvent}><Plus/></button>

    <div className="calendar-date-nav">
      <button aria-label="Previous period" onClick={() => move(-1)}><ChevronLeft/></button>
      <b>{pageLabel}</b>
      <button aria-label="Next period" onClick={() => move(1)}><ChevronRight/></button>
    </div>

    {notice && <div className="calendar-toast"><Check/>{notice}</div>}
    {!loading && events.length === 0 && <p className="checkin-copy">No events yet — scheduled check-ins and anything you add will show up here.</p>}

    <div className={`calendar-desktop-layout ${selected ? "has-detail" : ""}`}>
      {view === "week" ? (
        <section className="week-calendar-card interactive-week-card">
          <div className="week-calendar-header"><div className="time-head">All day</div>{weekDays.map(day=><button key={dateKey(day)} className={dateKey(day) === selected?.date ? "day-head selected" : "day-head"} onClick={() => setCursor(day)}>{weekdayNames[day.getDay()]} <b>{day.getDate()}</b></button>)}</div>
          <div className="week-calendar-body">
            <div className="time-column">{hours.map(hour=><div key={hour}>{hour}</div>)}</div>
            <div className="week-grid">
              {hours.map((_,i)=><span key={`h-${i}`} className="grid-line horizontal" style={{top:`${(i/14)*100}%`}}/>)}
              {[1,2,3,4,5,6].map(i=><span key={`v-${i}`} className="grid-line vertical" style={{left:`${(i/7)*100}%`}}/>)}
              {visibleEvents.map((event) => {
                const dayIndex = weekDays.findIndex((day) => dateKey(day) === event.date);
                if (dayIndex < 0) return null;
                return <button key={event.id} className={`desktop-calendar-event ${event.tone} ${selected?.id === event.id ? "selected" : ""}`} style={{left:`calc(${(dayIndex/7)*100}% + 8px)`,width:`calc(${100/7}% - 16px)`,top:`calc(${((eventRow(event)-1)/14)*100}% + 5px)`,height:`calc(${(1/14)*100}% - 10px)`}} onClick={() => setSelectedId(event.id)}><b>{event.title}</b><span>{event.channel} · {formatTime(event.start)}</span></button>;
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="month-calendar-card">
          <div className="month-calendar-head">{weekdayNames.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="month-calendar-grid">
            {monthDays.map((day) => {
              const key = dateKey(day);
              const dayEvents = events.filter((event) => event.date === key);
              return <article key={key} className={day.getMonth() === cursor.getMonth() ? "month-day" : "month-day muted-month"}>
                <button className={key === selected?.date ? "selected" : ""} onClick={() => setCursor(day)}>{day.getDate()}</button>
                <div>{dayEvents.slice(0, 3).map((event) => <button key={event.id} className={`month-event-dot ${event.tone}`} onClick={() => setSelectedId(event.id)}>{event.title}</button>)}</div>
              </article>;
            })}
          </div>
        </section>
      )}

      {selected && <aside className={`calendar-detail product-detail-panel ${selected.tone}`}>
        <div className="detail-panel-head"><span className="detail-type-icon"><EventToneIcon tone={selected.tone}/></span><button aria-label="More event actions"><MoreHorizontal/></button></div>
        <small className="detail-eyebrow">{selected.type}</small>
        <h2>{selected.title}</h2>
        <div className="detail-meta-row"><CalendarDays/><span><b>{weekdayNames[parseDate(selected.date).getDay()]}, {parseDate(selected.date).getDate()} {shortMonthNames[parseDate(selected.date).getMonth()]} {parseDate(selected.date).getFullYear()}</b><small>{formatTime(selected.start)}</small></span></div>
        <div className="detail-meta-row"><MessageCircle/><span><b>{selected.channel}</b><small>Nura will follow up through this channel.</small></span></div>
        <div className="detail-notes"><b>Notes</b><p>{selected.notes}</p></div>
        <div className="detail-actions"><button className="secondary-cta" onClick={openEditEvent}>Edit event</button><button className="danger-button" onClick={handleDelete}>Delete</button></div>
        <button className="detail-close" onClick={() => setSelectedId(null)}>Close</button>
      </aside>}
    </div>

    <div className="calendar-mobile-only">
      {view === "month" && (
        <section className="mobile-month-grid">
          <div className="mobile-month-head">{weekdayNames.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="mobile-month-days">
            {monthDays.map((day) => {
              const key = dateKey(day);
              const dayEvents = events.filter((event) => event.date === key);
              return (
                <article key={key} className={day.getMonth() === cursor.getMonth() ? "mobile-month-day" : "mobile-month-day muted-month"}>
                  <button className={key === dateKey(cursor) ? "selected" : ""} onClick={() => setCursor(day)}>{day.getDate()}</button>
                  {dayEvents.length > 0 && (
                    <div className="mobile-month-dots">
                      {dayEvents.slice(0, 3).map((event) => <span key={event.id} className={`mobile-month-dot ${event.tone}`} />)}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
      <section className="calendar-events">
        {(view === "month" ? events.filter((event) => event.date === dateKey(cursor)).sort(chronological) : visibleEvents).map((event) => (
          <button key={event.id} onClick={() => setSelectedId(event.id)} className={`calendar-item ${event.tone} ${selected?.id === event.id ? "selected" : ""}`}><div><small>{weekdayNames[parseDate(event.date).getDay()]} {parseDate(event.date).getDate()}</small><b>{formatTime(event.start)}</b></div><span><EventToneIcon tone={event.tone}/></span><div><h3>{event.title}</h3><p>{event.channel}</p></div></button>
        ))}
        {view === "month" && events.filter((event) => event.date === dateKey(cursor)).length === 0 && (
          <p className="checkin-copy">Nothing on {monthNames[parseDate(dateKey(cursor)).getMonth()]} {parseDate(dateKey(cursor)).getDate()}.</p>
        )}
      </section>
    </div>

    {modalMode && (
      <div className="calendar-modal-backdrop" role="dialog" aria-modal="true" aria-label={modalMode === "new" ? "New calendar event" : "Edit calendar event"}>
        <section className="calendar-edit-modal">
          <button className="modal-close" aria-label="Close event modal" onClick={() => setModalMode(null)}><X/></button>
          <span className={`detail-type-icon ${form.eventType}`}><EventToneIcon tone={form.eventType === "medication" ? "medication" : form.eventType === "document" ? "document" : "appointment"}/></span>
          <h2>{modalMode === "new" ? "New event" : "Edit event"}</h2>
          <label htmlFor="calendar-title">Title</label><input id="calendar-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}/>
          <div className="field-row"><div><label htmlFor="calendar-date">Date</label><input id="calendar-date" type="date" value={form.date} onInput={(e) => { const value = e.currentTarget.value; setForm((f) => ({ ...f, date: value })); }} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}/></div><div><label htmlFor="calendar-time">Time</label><input id="calendar-time" type="time" value={form.start} onInput={(e) => { const value = e.currentTarget.value; setForm((f) => ({ ...f, start: value })); }} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}/></div></div>
          <label htmlFor="calendar-type">Type</label><select id="calendar-type" value={form.eventType} onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}><option value="appointment">Appointment</option><option value="medication">Medication</option><option value="document">Document review</option></select>
          <label htmlFor="calendar-channel">Follow-up channel</label><select id="calendar-channel" value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}><option>In app</option><option>WhatsApp message</option><option>WhatsApp voice</option><option>Clinic visit</option></select>
          <label htmlFor="calendar-notes">Notes</label><textarea id="calendar-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}/>
          <div className="modal-actions"><button className="secondary-cta" onClick={() => setModalMode(null)}>Cancel</button><button className="primary-cta" onClick={handleSave} disabled={saving || !form.title.trim()}>{saving ? "Saving…" : "Save changes"}</button></div>
        </section>
      </div>
    )}
  </div></NuraShell>;
}
