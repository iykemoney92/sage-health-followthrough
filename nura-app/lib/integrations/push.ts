import webpush from "web-push";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
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

/** Native (iOS/Android) push, sent through Firebase — including iOS, since an
 * uploaded APNs key lets Firebase proxy those sends too, so this is the only
 * provider the backend needs to talk to for the Capacitor apps. */
export function isNativePushConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

function getFirebaseMessaging() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)),
    });
  }
  return getMessaging();
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
  const webConfigured = isPushConfigured();
  const nativeConfigured = isNativePushConfigured();
  if (!webConfigured && !nativeConfigured) {
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

  if (webConfigured) configureVapid();

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

  const [{ data: subs, error: loadError }, { data: nativeTokens, error: nativeLoadError }] = await Promise.all([
    webConfigured
      ? supabase.from("nura_push_subscriptions").select("id, endpoint, p256dh, auth_key").eq("owner_id", ownerId)
      : Promise.resolve({ data: [], error: null }),
    nativeConfigured
      ? supabase.from("nura_native_push_tokens").select("id, token").eq("owner_id", ownerId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (loadError) {
    return { sent: 0, pruned: 0, attempted: 0, error: loadError.message };
  }
  if (nativeLoadError) {
    return { sent: 0, pruned: 0, attempted: 0, error: nativeLoadError.message };
  }

  const attempted = (subs?.length ?? 0) + (nativeTokens?.length ?? 0);
  if (attempted === 0) {
    return { sent: 0, pruned: 0, attempted: 0, skipped: "no_subscriptions" };
  }

  const staleIds: string[] = [];
  const staleNativeIds: string[] = [];
  let sent = 0;
  let lastError: string | undefined;

  await Promise.all([
    ...(subs ?? []).map(async (sub) => {
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
    ...(nativeTokens ?? []).map(async (nativeToken) => {
      try {
        const messaging = getFirebaseMessaging();
        await messaging.send({
          token: nativeToken.token,
          notification: { title: normalized.title, body: normalized.body },
          data: { url: normalized.url ?? "/today" },
          apns: { payload: { aps: { sound: "default" } } },
        });
        sent += 1;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          staleNativeIds.push(nativeToken.id);
          return;
        }
        lastError = (error as { message?: string }).message || `Native push failed (${code ?? "unknown"})`;
      }
    }),
  ]);

  if (staleIds.length > 0) {
    await supabase.from("nura_push_subscriptions").delete().in("id", staleIds);
  }
  if (staleNativeIds.length > 0) {
    await supabase.from("nura_native_push_tokens").delete().in("id", staleNativeIds);
  }

  return {
    sent,
    pruned: staleIds.length + staleNativeIds.length,
    attempted,
    error: sent === 0 ? lastError : undefined,
  };
}
