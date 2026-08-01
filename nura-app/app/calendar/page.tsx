"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, FileText, MessageCircle, Pill, Plus, Stethoscope, X } from "lucide-react";
import { NuraShell } from "@/components/nura-shell";
import { RescheduleButton } from "@/components/nura-actions";
import { useToast } from "@/components/toast";
import { getAvatarUrl } from "@/lib/avatar";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";

const CALENDAR_BUILD = "interactive-calendar-v2";
const hours = ["7 AM","8 AM","9 AM","10 AM","11 AM","12 PM","1 PM","2 PM","3 PM","4 PM","5 PM","6 PM","7 PM","8 PM"];
const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const shortMonthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const weekdayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const weekStartNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

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

const emptyForm = { title: "", date: "", start: "09:00", channel: "In the app", notes: "", eventType: "appointment" };

export default function CalendarPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"new" | "edit" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState("You");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | undefined>();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Portals need document.body, which only exists client-side after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

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
      toast({
        tone: "info",
        title: "Care plan check-in",
        message: "Reschedule this from the Care plan’s check-in instead.",
      });
      return;
    }
    setForm({
      title: selected.title,
      date: selected.date,
      start: selected.start,
      channel: selected.channel === "In app" ? "In the app" : selected.channel,
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
  };

  const goToday = () => {
    setCursor(new Date());
    setSelectedId(null);
    toast({ tone: "info", message: view === "month" ? "Back to this month." : "Back to this week." });
  };

  const todayKey = dateKey(new Date());
  const cursorKey = dateKey(cursor);
  const upcomingCount = events.filter((event) => parseDate(event.date).getTime() >= parseDate(todayKey).getTime()).length;
  const monthSelectedEvents = events.filter((event) => event.date === cursorKey).sort(chronological);
  const weekDayCounts = weekDays.map((day) => {
    const key = dateKey(day);
    return {
      date: day,
      key,
      count: events.filter((event) => event.date === key).length,
      isToday: key === todayKey,
      isSelected: key === cursorKey,
    };
  });

  function formatDayHeading(value: string) {
    const date = parseDate(value);
    if (value === todayKey) return "Today";
    const tomorrow = addDays(new Date(), 1);
    if (value === dateKey(tomorrow)) return "Tomorrow";
    return `${weekdayNames[date.getDay()]} ${date.getDate()} ${shortMonthNames[date.getMonth()]}`;
  }

  function openEvent(event: CalendarEvent) {
    setSelectedId(event.id);
    setCursor(parseDate(event.date));
  }

  function closeDetail() {
    setSelectedId(null);
  }

  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selected]);

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
          toast({ title: "Added to calendar", message: `${currentForm.title} is saved so you can keep track of it.` });
        } else {
          toast({ tone: "error", message: "Couldn’t add that just now. Check the details and try again." });
        }
      } else if (modalMode === "edit" && selected) {
        if (selected.source !== "calendar_event") {
          toast({
            tone: "info",
            title: "Care plan check-in",
            message: "Reschedule this from the Care plan’s check-in instead.",
          });
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
            toast({ title: "Updated", message: `${currentForm.title} is up to date.` });
          } else {
            toast({ tone: "error", message: "Couldn’t save those updates. Please try again." });
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
      toast({
        tone: "info",
        title: "Care plan check-in",
        message: "Manage this from the Care plan page instead.",
      });
      return;
    }
    const res = await fetch(`/api/calendar-events/${selected.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      toast({ tone: "error", message: "Could not delete this event. Please try again." });
      return;
    }
    setEvents((prev) => prev.filter((event) => event.id !== selected.id));
    toast({ tone: "info", message: `${selected.title} deleted.` });
    closeDetail();
  }

  const isCheckIn = selected?.source === "check_in";
  const detailTitle = selected
    ? isCheckIn
      ? selected.title.replace(/\s*check-in$/i, "").trim() || selected.title
      : selected.title
    : "";
  const checkInHref =
    selected?.planId
      ? `/check-in?planId=${encodeURIComponent(selected.planId)}&title=${encodeURIComponent(detailTitle)}`
      : null;
  const journeyHref = selected?.planId ? `/plans/${selected.planId}` : null;

  const eventDetail =
    selected && mounted
      ? createPortal(
          <div className="calendar-event-overlay" role="presentation">
            <button
              type="button"
              className="calendar-event-backdrop"
              aria-label="Close details"
              onClick={closeDetail}
            />
            <aside
              className={`calendar-event-sheet ${selected.tone}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="calendar-event-detail-title"
            >
              <div className="calendar-event-sheet-handle" aria-hidden />
              <div className="calendar-event-sheet-head">
                <span className={`detail-type-icon ${selected.tone}`}>
                  <EventToneIcon tone={selected.tone} />
                </span>
                <button type="button" className="modal-close" aria-label="Close" onClick={closeDetail}>
                  <X />
                </button>
              </div>

              <small className="detail-eyebrow">
                {isCheckIn ? "Scheduled check-in" : selected.type}
              </small>
              <h2 id="calendar-event-detail-title">{detailTitle}</h2>
              <p className="calendar-event-sheet-lead">
                {isCheckIn
                  ? "Nura will check in about this Care plan at the time below."
                  : "Something you’ve added so it doesn’t get lost between visits."}
              </p>

              <div className="detail-meta-row">
                <CalendarDays aria-hidden />
                <span>
                  <b>
                    {weekdayNames[parseDate(selected.date).getDay()]}, {parseDate(selected.date).getDate()}{" "}
                    {shortMonthNames[parseDate(selected.date).getMonth()]} {parseDate(selected.date).getFullYear()}
                  </b>
                  <small>{formatTime(selected.start)}</small>
                </span>
              </div>
              <div className="detail-meta-row">
                <MessageCircle aria-hidden />
                <span>
                  <b>{selected.channel}</b>
                  <small>
                    {isCheckIn
                      ? "Nura will reach you through this channel."
                      : "How this is marked on your calendar."}
                  </small>
                </span>
              </div>

              {selected.notes ? (
                <div className="detail-notes">
                  <b>{isCheckIn ? "What Nura will ask about" : "Notes"}</b>
                  <p>{selected.notes}</p>
                </div>
              ) : null}

              <div className="detail-actions">
                {isCheckIn ? (
                  <>
                    {checkInHref && (
                      <Link href={checkInHref} className="primary-cta">
                        Do check-in
                      </Link>
                    )}
                    {journeyHref && (
                      <Link href={journeyHref} className="secondary-cta">
                        Open Care plan
                      </Link>
                    )}
                    {selected.planId && <RescheduleButton planId={selected.planId} />}
                  </>
                ) : (
                  <>
                    <button type="button" className="primary-cta" onClick={openEditEvent}>
                      Edit event
                    </button>
                    <button type="button" className="danger-button" onClick={handleDelete}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <NuraShell userName={userName} userAvatarUrl={userAvatarUrl}>
      <div className="dashboard-page calendar-page interactive-calendar calendar-v2" data-build={CALENDAR_BUILD}>
        <header className="dashboard-heading">
          <span className="auth-kicker">CALENDAR</span>
          <h1>Your calendar</h1>
          <p>
            {loading
              ? "Loading what’s coming up…"
              : upcomingCount === 0
                ? "Check-ins and appointments you add will show up here."
                : upcomingCount === 1
                  ? "1 upcoming follow-up on your calendar."
                  : `${upcomingCount} upcoming follow-ups on your calendar.`}
          </p>
        </header>

        <div className="calendar-controls">
          <button type="button" className="secondary-cta calendar-today" onClick={goToday}>
            Today
          </button>
          <div className="calendar-view-toggle" role="tablist" aria-label="Calendar view">
            <button type="button" className={view === "week" ? "active" : ""} onClick={() => setView("week")}>
              Week
            </button>
            <button type="button" className={view === "month" ? "active" : ""} onClick={() => setView("month")}>
              Month
            </button>
          </div>
        </div>

        <div className="calendar-date-nav">
          <button type="button" aria-label="Previous period" onClick={() => move(-1)}>
            <ChevronLeft />
          </button>
          <b>{pageLabel}</b>
          <button type="button" aria-label="Next period" onClick={() => move(1)}>
            <ChevronRight />
          </button>
        </div>

        <button type="button" className="calendar-floating-add" aria-label="New calendar event" onClick={openNewEvent}>
          <Plus />
        </button>

        <div className="calendar-desktop-layout">
          {view === "week" ? (
            <section className="week-calendar-card interactive-week-card">
              <div className="week-calendar-header">
                <div className="time-head">All day</div>
                {weekDays.map((day) => (
                  <button
                    type="button"
                    key={dateKey(day)}
                    className={dateKey(day) === selected?.date || dateKey(day) === cursorKey ? "day-head selected" : "day-head"}
                    onClick={() => setCursor(day)}
                  >
                    {weekdayNames[day.getDay()]} <b>{day.getDate()}</b>
                  </button>
                ))}
              </div>
              <div className="week-calendar-body">
                <div className="time-column">
                  {hours.map((hour) => (
                    <div key={hour}>{hour}</div>
                  ))}
                </div>
                <div className="week-grid">
                  {hours.map((_, i) => (
                    <span key={`h-${i}`} className="grid-line horizontal" style={{ top: `${(i / 14) * 100}%` }} />
                  ))}
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <span key={`v-${i}`} className="grid-line vertical" style={{ left: `${(i / 7) * 100}%` }} />
                  ))}
                  {visibleEvents.map((event) => {
                    const dayIndex = weekDays.findIndex((day) => dateKey(day) === event.date);
                    if (dayIndex < 0) return null;
                    return (
                      <button
                        type="button"
                        key={event.id}
                        className={`desktop-calendar-event ${event.tone} ${selected?.id === event.id ? "selected" : ""}`}
                        style={{
                          left: `calc(${(dayIndex / 7) * 100}% + 8px)`,
                          width: `calc(${100 / 7}% - 16px)`,
                          top: `calc(${((eventRow(event) - 1) / 14) * 100}% + 5px)`,
                          height: `calc(${(1 / 14) * 100}% - 10px)`,
                        }}
                        onClick={() => openEvent(event)}
                      >
                        <b>{event.title}</b>
                        <span>
                          {event.channel} · {formatTime(event.start)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : (
            <section className="month-calendar-card">
              <div className="month-calendar-head">
                {weekStartNames.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="month-calendar-grid">
                {monthDays.map((day) => {
                  const key = dateKey(day);
                  const dayEvents = events.filter((event) => event.date === key);
                  return (
                    <article key={key} className={day.getMonth() === cursor.getMonth() ? "month-day" : "month-day muted-month"}>
                      <button type="button" className={key === cursorKey ? "selected" : ""} onClick={() => setCursor(day)}>
                        {day.getDate()}
                      </button>
                      <div>
                        {dayEvents.slice(0, 3).map((event) => (
                          <button type="button" key={event.id} className={`month-event-dot ${event.tone}`} onClick={() => openEvent(event)}>
                            {event.title}
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="calendar-mobile-only">
          {view === "week" && (
            <section className="calendar-week-strip" aria-label="This week">
              {weekDayCounts.map((day) => (
                <button
                  type="button"
                  key={day.key}
                  className={[day.isSelected ? "selected" : "", day.isToday ? "is-today" : ""].filter(Boolean).join(" ") || undefined}
                  onClick={() => setCursor(day.date)}
                >
                  <small>{weekStartNames[day.date.getDay() === 0 ? 6 : day.date.getDay() - 1].slice(0, 3)}</small>
                  <b>{day.date.getDate()}</b>
                  <span className={day.count === 0 ? "empty" : ""}>{day.count === 0 ? "—" : day.count}</span>
                </button>
              ))}
            </section>
          )}

          {view === "month" && (
            <section className="mobile-month-grid">
              <div className="mobile-month-head">
                {weekStartNames.map((day) => (
                  <span key={day}>{day.slice(0, 1)}</span>
                ))}
              </div>
              <div className="mobile-month-days">
                {monthDays.map((day) => {
                  const key = dateKey(day);
                  const dayEvents = events.filter((event) => event.date === key);
                  return (
                    <article key={key} className={day.getMonth() === cursor.getMonth() ? "mobile-month-day" : "mobile-month-day muted-month"}>
                      <button type="button" className={key === cursorKey ? "selected" : ""} onClick={() => setCursor(day)}>
                        {day.getDate()}
                      </button>
                      {dayEvents.length > 0 && (
                        <div className="mobile-month-dots">
                          {dayEvents.slice(0, 3).map((event) => (
                            <span key={event.id} className={`mobile-month-dot ${event.tone}`} />
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="calendar-agenda" aria-label="Agenda">
            {loading ? (
              <p className="calendar-empty">Loading your calendar…</p>
            ) : view === "week" ? (
              visibleEvents.length > 0 ? (
                weekDays.map((day) => {
                  const key = dateKey(day);
                  const dayEvents = visibleEvents.filter((event) => event.date === key);
                  if (dayEvents.length === 0) return null;
                  return (
                    <div className="calendar-day-group" key={key}>
                      <div className="calendar-day-label">
                        <h2>{formatDayHeading(key)}</h2>
                        <small>
                          {dayEvents.length} {dayEvents.length === 1 ? "item" : "items"}
                        </small>
                      </div>
                      <div className="calendar-events">
                        {dayEvents.map((event) => (
                          <button
                            type="button"
                            key={event.id}
                            onClick={() => openEvent(event)}
                            className={`calendar-item ${event.tone} ${selected?.id === event.id ? "selected" : ""}`}
                          >
                            <div>
                              <small>{weekdayNames[parseDate(event.date).getDay()].slice(0, 3)}</small>
                              <b>{formatTime(event.start)}</b>
                            </div>
                            <span>
                              <EventToneIcon tone={event.tone} />
                            </span>
                            <div>
                              <h3>{event.title}</h3>
                              <p>{event.channel}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="calendar-empty-card">
                  <CalendarDays aria-hidden />
                  <h2>Nothing this week</h2>
                  <p>Scheduled check-ins and anything you add will land here.</p>
                  <button type="button" className="primary-cta" onClick={openNewEvent}>
                    <Plus /> Add event
                  </button>
                </div>
              )
            ) : monthSelectedEvents.length > 0 ? (
              <div className="calendar-day-group">
                <div className="calendar-day-label">
                  <h2>{formatDayHeading(cursorKey)}</h2>
                  <small>
                    {monthSelectedEvents.length} {monthSelectedEvents.length === 1 ? "item" : "items"}
                  </small>
                </div>
                <div className="calendar-events">
                  {monthSelectedEvents.map((event) => (
                    <button
                      type="button"
                      key={event.id}
                      onClick={() => openEvent(event)}
                      className={`calendar-item ${event.tone} ${selected?.id === event.id ? "selected" : ""}`}
                    >
                      <div>
                        <small>{weekdayNames[parseDate(event.date).getDay()].slice(0, 3)}</small>
                        <b>{formatTime(event.start)}</b>
                      </div>
                      <span>
                        <EventToneIcon tone={event.tone} />
                      </span>
                      <div>
                        <h3>{event.title}</h3>
                        <p>{event.channel}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="calendar-empty-card compact">
                <h2>Nothing on {formatDayHeading(cursorKey)}</h2>
                <p>Pick another day, or add something for this one.</p>
                <button type="button" className="secondary-cta" onClick={openNewEvent}>
                  <Plus /> Add event
                </button>
              </div>
            )}
          </section>
        </div>

        {modalMode && (
          <div
            className="calendar-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-event-title"
            aria-label={modalMode === "new" ? "Add to your calendar" : "Update calendar event"}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !saving) setModalMode(null);
            }}
          >
            <section className="calendar-edit-modal nura-event-modal">
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={() => setModalMode(null)}
                disabled={saving}
              >
                <X />
              </button>

              <div className="modal-heading">
                <span className={`modal-icon detail-type-icon ${form.eventType}`}>
                  <EventToneIcon
                    tone={
                      form.eventType === "medication"
                        ? "medication"
                        : form.eventType === "document"
                          ? "document"
                          : "appointment"
                    }
                  />
                </span>
                <div>
                  <h2 id="calendar-event-title">
                    {modalMode === "new" ? "Add to your calendar" : "Update this event"}
                  </h2>
                  <p>
                    {modalMode === "new"
                      ? "Capture an appointment, reminder, or review so it doesn’t get lost between visits."
                      : "Change the details Nura should keep for this follow-through."}
                  </p>
                </div>
              </div>

              <div className="nura-event-fields">
              <label htmlFor="calendar-title">
                What is this for?
                <input
                  id="calendar-title"
                  value={form.title}
                  placeholder="e.g. GP follow-up, blood test, evening tablet"
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>

              <div className="field-row">
                <label htmlFor="calendar-date">
                  Date
                  <input
                    id="calendar-date"
                    type="date"
                    value={form.date}
                    onInput={(e) => {
                      const value = e.currentTarget.value;
                      setForm((f) => ({ ...f, date: value }));
                    }}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </label>
                <label htmlFor="calendar-time">
                  Time
                  <input
                    id="calendar-time"
                    type="time"
                    value={form.start}
                    onInput={(e) => {
                      const value = e.currentTarget.value;
                      setForm((f) => ({ ...f, start: value }));
                    }}
                    onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  />
                </label>
              </div>

              <label htmlFor="calendar-type">
                What kind of event?
                <select
                  id="calendar-type"
                  value={form.eventType}
                  onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
                >
                  <option value="appointment">Clinic appointment</option>
                  <option value="medication">Medication reminder</option>
                  <option value="document">Document or results review</option>
                </select>
              </label>

              <label htmlFor="calendar-channel">
                How will this happen?
                <select
                  id="calendar-channel"
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                >
                  <option>In the app</option>
                  <option>WhatsApp message</option>
                  <option>WhatsApp voice</option>
                  <option>Clinic visit</option>
                </select>
              </label>

              <label htmlFor="calendar-notes">
                Anything to remember?
                <textarea
                  id="calendar-notes"
                  value={form.notes}
                  placeholder="Optional — questions for your clinician, prep notes, or what to watch for"
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="secondary-cta" onClick={() => setModalMode(null)} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-cta"
                  onClick={handleSave}
                  disabled={saving || !form.title.trim()}
                >
                  {saving
                    ? modalMode === "new"
                      ? "Adding…"
                      : "Saving…"
                    : modalMode === "new"
                      ? "Add to calendar"
                      : "Save updates"}
                </button>
              </div>
            </section>
          </div>
        )}
        {eventDetail}
      </div>
    </NuraShell>
  );
}
