export type CheckinStyle = "gentle" | "conversational" | "brief";

export type QuietHoursSettings = {
  start: string;
  end: string;
  allowUrgent: boolean;
  enabled: boolean;
};

export type HealthMedication = {
  id: string;
  name: string;
  note: string;
  addedAt: string;
};

export type HealthContact = {
  id: string;
  name: string;
  role: string;
  note: string;
  addedAt: string;
};

export type ProfileSettings = {
  quietHours: QuietHoursSettings;
  checkinStyle: CheckinStyle;
  medications: HealthMedication[];
  contacts: HealthContact[];
};

const DEFAULT_SETTINGS: ProfileSettings = {
  quietHours: {
    start: "22:00",
    end: "07:00",
    allowUrgent: true,
    enabled: false,
  },
  checkinStyle: "gentle",
  medications: [],
  contacts: [],
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBool(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function parseMedications(value: unknown): HealthMedication[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const id = asString(item.id);
      const name = asString(item.name).trim();
      if (!id || !name) return null;
      return {
        id,
        name,
        note: asString(item.note).trim(),
        addedAt: asString(item.addedAt) || new Date().toISOString(),
      };
    })
    .filter((row): row is HealthMedication => Boolean(row));
}

function parseContacts(value: unknown): HealthContact[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const id = asString(item.id);
      const name = asString(item.name).trim();
      if (!id || !name) return null;
      return {
        id,
        name,
        role: asString(item.role).trim() || "Care contact",
        note: asString(item.note).trim(),
        addedAt: asString(item.addedAt) || new Date().toISOString(),
      };
    })
    .filter((row): row is HealthContact => Boolean(row));
}

export function readProfileSettings(metadata: Record<string, unknown> | null | undefined): ProfileSettings {
  const meta = metadata ?? {};
  const style = asString(meta.checkin_style, "gentle");
  return {
    quietHours: {
      start: asString(meta.quiet_hours_start, DEFAULT_SETTINGS.quietHours.start),
      end: asString(meta.quiet_hours_end, DEFAULT_SETTINGS.quietHours.end),
      allowUrgent: asBool(meta.quiet_hours_allow_urgent, true),
      enabled: asBool(meta.quiet_hours_enabled, false),
    },
    checkinStyle: style === "conversational" || style === "brief" ? style : "gentle",
    medications: parseMedications(meta.health_medications),
    contacts: parseContacts(meta.health_contacts),
  };
}

export function profileSettingsToMetadata(settings: ProfileSettings) {
  return {
    quiet_hours_start: settings.quietHours.start,
    quiet_hours_end: settings.quietHours.end,
    quiet_hours_allow_urgent: settings.quietHours.allowUrgent,
    quiet_hours_enabled: settings.quietHours.enabled,
    checkin_style: settings.checkinStyle,
    health_medications: settings.medications,
    health_contacts: settings.contacts,
  };
}

export function createHealthId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `health-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
