import { z } from "zod";

export const calendarEventTypeSchema = z.enum(["appointment", "medication", "document"]);

export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const calendarTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM");

export function parseLocalCalendarDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes
  ) {
    return null;
  }

  return parsed;
}

export function toneForCalendarEvent(eventType: string, category?: string | null) {
  if (eventType === "check_in") {
    if (category === "medication_follow_through") return "medication";
    return "health";
  }
  if (eventType === "medication") return "medication";
  if (eventType === "document") return "document";
  return "appointment";
}

export function calendarEventTypeLabel(eventType: string) {
  if (eventType === "medication") return "Medication reminder";
  if (eventType === "document") return "Document or results review";
  return "Clinic appointment";
}
