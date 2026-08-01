import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calendarDateSchema, calendarEventTypeLabel, calendarEventTypeSchema, calendarTimeSchema, parseLocalCalendarDateTime, toneForCalendarEvent } from "@/lib/api/calendar-events";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  title: z.string().trim().min(1),
  date: calendarDateSchema,
  start: calendarTimeSchema,
  channel: z.string().optional().default("In the app"),
  notes: z.string().optional().default(""),
  eventType: calendarEventTypeSchema.optional().default("appointment"),
});

function channelLabel(channel?: string | null) {
  if (channel === "whatsapp") return "WhatsApp message";
  if (channel === "voice") return "WhatsApp voice";
  if (channel === "in_app" || channel === "In app") return "In the app";
  return channel || "In the app";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();

  const [{ data: calendarEvents, error: calendarError }, { data: checkIns, error: checkInsError }] = await Promise.all([
    supabase.from("nura_calendar_events").select("id, title, event_type, starts_at, channel, notes, plan_id").eq("owner_id", user.id),
    supabase.from("nura_check_ins").select("id, scheduled_for, channel, plan_id, nura_plans(title, category)").eq("owner_id", user.id).is("completed_at", null),
  ]);

  if (calendarError || checkInsError) {
    return NextResponse.json({ ok: false, error: calendarError?.message ?? checkInsError?.message }, { status: 500 });
  }

  const fromCalendar = (calendarEvents ?? []).map((event) => ({
    id: event.id as string,
    source: "calendar_event" as const,
    title: event.title as string,
    startsAt: event.starts_at as string,
    tone: toneForCalendarEvent(event.event_type as string),
    type: calendarEventTypeLabel(event.event_type as string),
    channel: channelLabel(event.channel as string | null),
    notes: (event.notes as string) || "",
    planId: event.plan_id as string | null,
  }));

  const fromCheckIns = (checkIns ?? []).map((checkIn) => {
    const plan = checkIn.nura_plans as unknown as { title: string; category: string } | null;
    return {
      id: checkIn.id as string,
      source: "check_in" as const,
      title: `${plan?.title ?? "Care plan"} check-in`,
      startsAt: checkIn.scheduled_for as string,
      tone: toneForCalendarEvent("check_in", plan?.category),
      type: "Check-in",
      channel: channelLabel(checkIn.channel as string | null),
      notes: `Nura will check in about ${plan?.title ?? "this Care plan"}.`,
      planId: checkIn.plan_id as string | null,
    };
  });

  return NextResponse.json({ ok: true, events: [...fromCalendar, ...fromCheckIns] });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, date, start, channel, notes, eventType } = parsed.data;
  const startsAtDate = parseLocalCalendarDateTime(date, start);
  if (!startsAtDate) {
    return NextResponse.json({ ok: false, error: "invalid date or time" }, { status: 400 });
  }

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase
    .from("nura_calendar_events")
    .insert({ owner_id: user.id, title, event_type: eventType, starts_at: startsAtDate.toISOString(), channel, notes })
    .select("id, title, event_type, starts_at, channel, notes, plan_id")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: error?.message ?? "insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    event: {
      id: data.id,
      source: "calendar_event",
      title: data.title,
      startsAt: data.starts_at,
      tone: toneForCalendarEvent(data.event_type as string),
      type: calendarEventTypeLabel(data.event_type as string),
      channel: data.channel,
      notes: data.notes,
      planId: data.plan_id,
    },
  });
}
