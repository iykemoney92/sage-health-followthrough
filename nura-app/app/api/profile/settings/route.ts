import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createHealthId,
  profileSettingsToMetadata,
  readProfileSettings,
  type ProfileSettings,
} from "@/lib/profile-settings";
import { getSessionUser, getSupabaseSessionClient } from "@/lib/integrations/supabase-server";

const preferencesSchema = z.object({
  action: z.literal("preferences"),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursAllowUrgent: z.boolean(),
  checkinStyle: z.enum(["gentle", "conversational", "brief"]),
});

const addMedicationSchema = z.object({
  action: z.literal("add_medication"),
  name: z.string().trim().min(1).max(120),
  note: z.string().trim().max(240).optional().or(z.literal("")),
});

const addContactSchema = z.object({
  action: z.literal("add_contact"),
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().trim().max(240).optional().or(z.literal("")),
});

const removeSchema = z.object({
  action: z.enum(["remove_medication", "remove_contact"]),
  id: z.string().min(1),
});

const requestSchema = z.discriminatedUnion("action", [
  preferencesSchema,
  addMedicationSchema,
  addContactSchema,
  removeSchema,
]);

async function saveSettings(
  supabase: Awaited<ReturnType<typeof getSupabaseSessionClient>>,
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>,
  next: ProfileSettings,
) {
  const metadata = {
    ...user.user_metadata,
    ...profileSettingsToMetadata(next),
  };
  const { error } = await supabase.auth.updateUser({ data: metadata });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, settings: next });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    settings: readProfileSettings(user.user_metadata as Record<string, unknown>),
  });
}

export async function PATCH(request: NextRequest) {
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
  const current = readProfileSettings(user.user_metadata as Record<string, unknown>);
  const payload = parsed.data;

  if (payload.action === "preferences") {
    const next: ProfileSettings = {
      ...current,
      quietHours: {
        enabled: payload.quietHoursEnabled,
        start: payload.quietHoursStart,
        end: payload.quietHoursEnd,
        allowUrgent: payload.quietHoursAllowUrgent,
      },
      checkinStyle: payload.checkinStyle,
    };
    return saveSettings(supabase, user, next);
  }

  if (payload.action === "add_medication") {
    const next: ProfileSettings = {
      ...current,
      medications: [
        {
          id: createHealthId(),
          name: payload.name,
          note: payload.note || "",
          addedAt: new Date().toISOString(),
        },
        ...current.medications,
      ].slice(0, 40),
    };
    return saveSettings(supabase, user, next);
  }

  if (payload.action === "add_contact") {
    const next: ProfileSettings = {
      ...current,
      contacts: [
        {
          id: createHealthId(),
          name: payload.name,
          role: payload.role || "Care contact",
          note: payload.note || "",
          addedAt: new Date().toISOString(),
        },
        ...current.contacts,
      ].slice(0, 40),
    };
    return saveSettings(supabase, user, next);
  }

  if (payload.action === "remove_medication") {
    const next: ProfileSettings = {
      ...current,
      medications: current.medications.filter((row) => row.id !== payload.id),
    };
    return saveSettings(supabase, user, next);
  }

  const next: ProfileSettings = {
    ...current,
    contacts: current.contacts.filter((row) => row.id !== payload.id),
  };
  return saveSettings(supabase, user, next);
}
