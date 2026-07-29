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

type PushPayload = { title: string; body: string; url?: string };

/**
 * Sends a push notification to every browser subscription an owner has
 * registered. Subscriptions the push service reports as gone (410/404 -
 * the user uninstalled, cleared site data, or revoked permission) are
 * pruned so future sends don't keep retrying dead endpoints.
 */
export async function sendPushToOwner(ownerId: string, payload: PushPayload) {
  if (!isPushConfigured()) return { sent: 0, skipped: "not_configured" as const };
  configureVapid();

  const supabase = getSupabaseServerClient();
  const { data: subs } = await supabase
    .from("nura_push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("owner_id", ownerId);

  if (!subs || subs.length === 0) return { sent: 0, skipped: "no_subscriptions" as const };

  const staleIds: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) staleIds.push(sub.id);
      }
    }),
  );

  if (staleIds.length > 0) {
    await supabase.from("nura_push_subscriptions").delete().in("id", staleIds);
  }

  return { sent, pruned: staleIds.length };
}
