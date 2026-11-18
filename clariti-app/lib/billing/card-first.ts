import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSubscriptionAccess,
  isSubscriptionLockedOut,
  markExpiredSubscriptionIfNeeded,
  type PlusState,
  type SubscriptionAccess,
} from "@/lib/billing/subscription";
import { syncPlusFromRevenueCat } from "@/lib/billing/sync-plus";
import { syncPlusFromStripe } from "@/lib/billing/sync-plus-stripe";
import { getOptionalSupabaseServiceClient } from "@/lib/integrations/supabase";

/**
 * Card-first (Ike, 18 Nov 2026): nobody gets an analysis until a trial has
 * started, which means a card that passed the check on the web or a store
 * subscription in the apps. There is no skip.
 *
 * CLARITI_CARD_FIRST_SURFACES lists where it applies ("web,ios,android" by
 * default; "off" for nowhere). It is the switch for a store that cannot sell:
 * if Play stops returning the Plus products, taking "android" out puts those
 * users back on the old free allowance without a deploy, instead of leaving
 * them at a wall with no button that works.
 */
export type Surface = "web" | "ios" | "android";

export const START_TRIAL_PATH = "/start-trial";
export const LOCKED_PATH = "/billing/locked";

export function surfaceFromUserAgent(userAgent: string | null | undefined): Surface {
  const ua = userAgent ?? "";
  if (!ua.includes("ClaritiApp")) return "web";
  return /android/i.test(ua) ? "android" : "ios";
}

export function cardFirstSurfaces(): Surface[] {
  const raw = process.env.CLARITI_CARD_FIRST_SURFACES?.trim().toLowerCase();
  if (raw === undefined || raw === "") return ["web", "ios", "android"];
  return raw.split(",").map((part) => part.trim()).filter((part): part is Surface => part === "web" || part === "ios" || part === "android");
}

export function cardFirstApplies(userAgent: string | null | undefined) {
  return cardFirstSurfaces().includes(surfaceFromUserAgent(userAgent));
}

/**
 * Access as the stores see it, not only as the profile last recorded it.
 *
 * A profile that says "no Plus" is asked about once more: RevenueCat for a store
 * purchase whose webhook never landed, then Stripe for a web trial that turned
 * paid or renewed (nothing pushes those to us). Accounts with Plus skip both
 * calls, so a subscriber pays nothing for this.
 */
export async function resolveAccess(sessionClient: SupabaseClient, ownerId: string): Promise<SubscriptionAccess> {
  const service = getOptionalSupabaseServiceClient();
  const reader = service ?? sessionClient;
  let access = await getSubscriptionAccess(reader, ownerId);
  if (access.hasPlus || !service) return access;

  try {
    const fromStore = await syncPlusFromRevenueCat(service, ownerId);
    const found = fromStore.hasPlus || (await syncPlusFromStripe(service, ownerId)).hasPlus;
    if (found) access = await getSubscriptionAccess(service, ownerId);
  } catch (error) {
    console.error("[billing] store sync failed", error);
  }
  if (!access.hasPlus && access.status === "expired") {
    access = await markExpiredSubscriptionIfNeeded(service, ownerId, access);
  }
  return access;
}

/** Where someone without Plus belongs: the renew screen if a trial or plan lapsed, the trial step otherwise. */
export function paywallPathFor(access: PlusState) {
  return isSubscriptionLockedOut(access) ? LOCKED_PATH : START_TRIAL_PATH;
}

/**
 * The server half of card-first. Returns the 402 the workspace already knows how
 * to show ("plus_required") when this surface is card-first and the account has
 * no trial or plan; null lets the request through to the route's own limits.
 */
export async function requireTrialOrPlus(request: Request, sessionClient: SupabaseClient, ownerId: string) {
  if (!cardFirstApplies(request.headers.get("user-agent"))) return null;
  const access = await resolveAccess(sessionClient, ownerId);
  if (access.hasPlus) return null;
  const lapsed = isSubscriptionLockedOut(access);
  return NextResponse.json(
    {
      ok: false,
      error: "plus_required",
      feature: "trial",
      upgradeUrl: paywallPathFor(access),
      message: lapsed
        ? "Your Clariti Plus trial or plan has ended. Renew to keep going."
        : "Start your 7-day free trial to use Clariti. You won't be charged today.",
    },
    { status: 402 },
  );
}
