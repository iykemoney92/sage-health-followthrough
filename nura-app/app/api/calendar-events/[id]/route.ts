import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calendarDateSchema, calendarEventTypeLabel, calendarEventTypeSchema, calendarTimeSchema, parseLocalCalendarDateTime, toneForCalendarEvent } from "@/lib/api/calendar-events";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const requestSchema = z.object({
  title: z.string().trim().min(1).optional(),
  date: calendarDateSchema.optional(),
  start: calendarTimeSchema.optional(),
  channel: z.string().optional(),
  notes: z.string().optional(),
  eventType: calendarEventTypeSchema.optional(),
}).refine((value) => (!value.date && !value.start) || (value.date && value.start), {
  message: "date and start must be provided together",
  path: ["start"],
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await getSupabaseSessionClient();
  const update: Record<string, string> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.channel !== undefined) update.channel = parsed.data.channel;
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
  if (parsed.data.eventType !== undefined) update.event_type = parsed.data.eventType;
  if (parsed.data.date && parsed.data.start) {
    const startsAtDate = parseLocalCalendarDateTime(parsed.data.date, parsed.data.start);
    if (!startsAtDate) {
      return NextResponse.json({ ok: false, error: "invalid date or time" }, { status: 400 });
    }
    update.starts_at = startsAtDate.toISOString();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "no changes provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("nura_calendar_events")
    .update(update)
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id, title, event_type, starts_at, channel, notes, plan_id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "event not found" }, { status: 404 });
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

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await getSupabaseSessionClient();
  const { data, error } = await supabase.from("nura_calendar_events").delete().eq("id", id).eq("owner_id", user.id).select("id").maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ ok: false, error: "event not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
