/**
 * Check that a new trial's card can really pay (Ike, 16 Nov 2026: "we check card can be able to make
 * payment before allowing through"). Stripe Checkout only confirms the card exists; this places a hold of
 * one unit of the trial's currency on it and releases it at once. Declined (no funds, blocked, expired):
 * the trial is cancelled before it unlocks anything, and the person is asked for another card. A card
 * whose bank wants the person present for the hold passed Stripe's own check at Checkout moments before,
 * so it goes through. Once per subscription (its metadata card_check), so a reload never holds twice.
 * Errors that say nothing about the card (Stripe unreachable) let it through rather than lock someone out.
 */

type StripeError = { error?: { type?: string; code?: string; decline_code?: string; payment_intent?: { id?: string } } };
type PaymentMethodRef = string | { id?: string } | null | undefined;
type Subscription = {
  id: string;
  currency?: string;
  customer?: string | { id?: string; invoice_settings?: { default_payment_method?: PaymentMethodRef } } | null;
  default_payment_method?: PaymentMethodRef;
  metadata?: Record<string, string> | null;
};

const idOf = (v: PaymentMethodRef) => (typeof v === "string" ? v : v?.id ?? null);

export type CardCheck = "ok" | "failed" | "unknown";

export async function checkTrialCard(secretKey: string, subscriptionId: string): Promise<CardCheck> {
  const api = async (method: string, path: string, form?: Record<string, string>, idem?: string) => {
    const r = await fetch(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(idem ? { "Idempotency-Key": idem } : {}),
      },
      body: form ? new URLSearchParams(form) : undefined,
      cache: "no-store",
    });
    return { ok: r.ok, body: (await r.json().catch(() => ({}))) as Record<string, unknown> & StripeError };
  };

  const got = await api("GET", `subscriptions/${encodeURIComponent(subscriptionId)}?expand[]=default_payment_method&expand[]=customer`);
  if (!got.ok) return "unknown";
  const sub = got.body as unknown as Subscription;
  const done = sub.metadata?.card_check;
  if (done) return done.startsWith("failed") ? "failed" : "ok";
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const pm = idOf(sub.default_payment_method) ?? (typeof sub.customer === "object" ? idOf(sub.customer?.invoice_settings?.default_payment_method) : null);
  if (!customer || !pm || !sub.currency) return "unknown";

  const hold = await api(
    "POST",
    "payment_intents",
    {
      amount: "100",
      currency: sub.currency,
      customer,
      payment_method: pm,
      capture_method: "manual",
      confirm: "true",
      off_session: "true",
      description: "Clariti card check: a small hold, released at once",
      statement_descriptor_suffix: "CARD CHECK",
      "metadata[kind]": "clariti_card_check",
      "metadata[subscription]": sub.id,
    },
    `clariti-card-check-${sub.id}`,
  );
  let outcome: string;
  if (hold.ok) {
    outcome = hold.body.status === "requires_capture" ? "ok" : `failed:${String(hold.body.status)}`;
    await api("POST", `payment_intents/${hold.body.id}/cancel`, {});
  } else {
    const e = hold.body.error ?? {};
    if (e.payment_intent?.id) await api("POST", `payment_intents/${e.payment_intent.id}/cancel`, {});
    if (e.code === "authentication_required") outcome = "ok:needs_presence";
    else if (e.type === "card_error") outcome = `failed:${e.decline_code ?? e.code ?? "declined"}`;
    else if (e.type === "idempotency_error") {
      // A second return for the same subscription while the first check is running: read its answer.
      const again = await api("GET", `subscriptions/${encodeURIComponent(subscriptionId)}`);
      const mark = (again.body as { metadata?: Record<string, string> }).metadata?.card_check;
      return mark ? (mark.startsWith("failed") ? "failed" : "ok") : "unknown";
    } else return "unknown";
  }
  // Marked first so nothing reads a failed card as Plus (sync-plus-stripe skips it) even if the cancel
  // below doesn't go through; the cancel is confirmed and retried once.
  await api("POST", `subscriptions/${sub.id}`, { "metadata[card_check]": outcome });
  if (!outcome.startsWith("failed")) return "ok";
  let cancelled = await api("DELETE", `subscriptions/${sub.id}`);
  if (!cancelled.ok) cancelled = await api("DELETE", `subscriptions/${sub.id}`);
  if (!cancelled.ok) console.error("[card-check] cancel failed for", sub.id);
  return "failed";
}
