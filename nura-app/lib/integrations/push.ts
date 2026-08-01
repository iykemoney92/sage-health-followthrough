import webpush from "web-push";
import { getSupabaseServerClient } from "@/lib/integrations/supabase";

export function isPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configureVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@usenura.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export type PushPayload = {
  title: string;
  body: string;
  /** App-relative path only, e.g. `/today` or `/plans/<id>`. */
  url?: string;
};

export type SendPushResult = {
  sent: number;
  pruned: number;
  attempted: number;
  skipped?: "not_configured" | "no_subscriptions" | "invalid_payload" | "rate_limited";
  error?: string;
};

const MAX_TITLE = 80;
const MAX_BODY = 180;
/** Soft per-owner cooldown so the voice agent cannot spam push. */
const MIN_PUSH_GAP_MS = 45_000;

const lastPushByOwner = new Map<string, number>();

function consumeRateLimit(ownerId: string): boolean {
  const now = Date.now();
  const prev = lastPushByOwner.get(ownerId) ?? 0;
  if (now - prev < MIN_PUSH_GAP_MS) return false;
  lastPushByOwner.set(ownerId, now);
  return true;
}

/** Keep notification deep-links inside the app (no open redirects). */
export function sanitizePushUrl(url: string | undefined): string {
  const fallback = "/today";
  if (!url || typeof url !== "string") return fallback;
  const trimmed = url.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://") || trimmed.includes("\\")) return fallback;
  return trimmed.slice(0, 200) || fallback;
}

function normalizePayload(payload: PushPayload): PushPayload | null {
  const title = (payload.title || "").trim().slice(0, MAX_TITLE);
  const body = (payload.body || "").trim().slice(0, MAX_BODY);
  if (!title || !body) return null;
  return {
    title,
    body,
    url: sanitizePushUrl(payload.url),
  };
}

/**
 * Sends a push notification to every browser subscription an owner has
 * registered. Subscriptions the push service reports as gone (410/404 -
 * the user uninstalled, cleared site data, or revoked permission) are
 * pruned so future sends don't keep retrying dead endpoints.
 */
export async function sendPushToOwner(
  ownerId: string,
  payload: PushPayload,
  options?: { bypassRateLimit?: boolean },
): Promise<SendPushResult> {
  if (!isPushConfigured()) {
    return { sent: 0, pruned: 0, attempted: 0, skipped: "not_configured" };
  }

  if (!options?.bypassRateLimit && !consumeRateLimit(ownerId)) {
    return {
      sent: 0,
      pruned: 0,
      attempted: 0,
      skipped: "rate_limited",
      error: "A notification was just sent — wait a moment before sending another.",
    };
  }

  const normalized = normalizePayload(payload);
  if (!normalized) {
    return { sent: 0, pruned: 0, attempted: 0, skipped: "invalid_payload", error: "Title and body are required." };
  }

  configureVapid();

  let supabase: ReturnType<typeof getSupabaseServerClient>;
  try {
    supabase = getSupabaseServerClient();
  } catch (error) {
    return {
      sent: 0,
      pruned: 0,
      attempted: 0,
      skipped: "not_configured",
      error: error instanceof Error ? error.message : "Supabase is not configured",
    };
  }

  const { data: subs, error: loadError } = await supabase
    .from("nura_push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("owner_id", ownerId);

  if (loadError) {
    return { sent: 0, pruned: 0, attempted: 0, error: loadError.message };
  }

  if (!subs || subs.length === 0) {
    return { sent: 0, pruned: 0, attempted: 0, skipped: "no_subscriptions" };
  }

  const staleIds: string[] = [];
  let sent = 0;
  let lastError: string | undefined;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          JSON.stringify(normalized),
          { TTL: 60 * 60, urgency: "normal" },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number; body?: string; message?: string }).statusCode;
        if (status === 404 || status === 410) {
          staleIds.push(sub.id);
          return;
        }
        lastError =
          (error as { message?: string }).message
          || (typeof (error as { body?: string }).body === "string" ? (error as { body: string }).body : undefined)
          || `Push failed (${status ?? "unknown"})`;
      }
    }),
  );

  if (staleIds.length > 0) {
    await supabase.from("nura_push_subscriptions").delete().in("id", staleIds);
  }

  return {
    sent,
    pruned: staleIds.length,
    attempted: subs.length,
    error: sent === 0 ? lastError : undefined,
  };
}
