"use client";

import { Capacitor } from "@capacitor/core";
import {
  LOG_LEVEL,
  Purchases,
  type PurchasesOffering,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";

/**
 * The entitlement the rest of the system already keys off. The RevenueCat
 * webhook treats `entitlement_ids` containing "plus" as authoritative, so a
 * StoreKit purchase lands in nura_profiles through exactly the same path a web
 * purchase does — no backend branch for the store.
 */
export const PLUS_ENTITLEMENT = "plus";

/**
 * Apple requires In-App Purchase for digital content sold inside the app
 * (Guideline 3.1.1), so the web checkout at pay.rev.cat cannot be reached from
 * the iOS build. This module is that replacement, and it is deliberately inert
 * anywhere `appl_`-keyed native purchasing isn't configured.
 */
const IOS_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY?.trim();
const ANDROID_API_KEY = process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim();

function apiKeyForPlatform() {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return IOS_API_KEY;
  if (platform === "android") return ANDROID_API_KEY;
  return undefined;
}

/** True only where a real store purchase can be made. */
export function isNativePurchaseAvailable() {
  return Capacitor.isNativePlatform() && Boolean(apiKeyForPlatform());
}

let configuredFor: string | null = null;

/**
 * Binds the RevenueCat SDK to the signed-in Supabase user.
 *
 * appUserID is the Supabase user id on purpose: the webhook resolves a
 * subscriber by matching app_user_id against nura_profiles.id first, so using
 * anything else here would create an anonymous subscriber whose purchase never
 * reaches the right account. Re-configuring on user change keeps a second
 * sign-in on the same device from inheriting the first user's entitlements.
 */
export async function configureNativePurchases(userId: string) {
  const apiKey = apiKeyForPlatform();
  if (!Capacitor.isNativePlatform() || !apiKey) return false;
  if (configuredFor === userId) return true;

  await Purchases.setLogLevel({
    level: process.env.NODE_ENV === "production" ? LOG_LEVEL.ERROR : LOG_LEVEL.DEBUG,
  });
  await Purchases.configure({ apiKey, appUserID: userId });
  configuredFor = userId;
  return true;
}

export type PlusOffer = {
  package: PurchasesPackage;
  /** Store-localised price string — never hardcode a currency in the UI. */
  priceString: string;
  period: string | null;
};

/**
 * The Plus offering, priced and localised by the store.
 *
 * Apple rejects hardcoded prices that disagree with the storefront, and the
 * same product costs different amounts in different regions, so the caller
 * renders `priceString` verbatim rather than formatting anything itself.
 */
export async function getPlusOffer(): Promise<PlusOffer | null> {
  const { current } = (await Purchases.getOfferings()) as { current: PurchasesOffering | null };
  const chosen = current?.availablePackages?.[0];
  if (!chosen) return null;

  return {
    package: chosen,
    priceString: chosen.product.priceString,
    period: chosen.product.subscriptionPeriod ?? null,
  };
}

export type PurchaseOutcome =
  | { status: "purchased" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

export async function purchasePlus(target: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: target });
    return customerInfo.entitlements.active[PLUS_ENTITLEMENT]
      ? { status: "purchased" }
      : // StoreKit reported success but the entitlement is absent — usually a
        // deferred/pending purchase (Ask to Buy). Treat it as not-yet-active
        // rather than granting access the receipt doesn't support.
        { status: "error", message: "Your purchase is still being confirmed. This can take a moment." };
  } catch (error) {
    if (isUserCancelled(error)) return { status: "cancelled" };
    return { status: "error", message: readableStoreError(error) };
  }
}

/**
 * Guideline 3.1.1 requires a way to restore purchases, and it has to work for
 * someone who reinstalled or signed in on a new device.
 */
export async function restorePlus(): Promise<PurchaseOutcome & { restored?: boolean }> {
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return {
      status: "purchased",
      restored: Boolean(customerInfo.entitlements.active[PLUS_ENTITLEMENT]),
    };
  } catch (error) {
    return { status: "error", message: readableStoreError(error) };
  }
}

function isUserCancelled(error: unknown) {
  const candidate = error as { code?: string | number; userCancelled?: boolean } | null;
  // The plugin surfaces cancellation differently across versions; both shapes
  // mean "they backed out", which is not an error worth showing.
  return Boolean(candidate?.userCancelled) || String(candidate?.code) === "1";
}

function readableStoreError(error: unknown) {
  const message = (error as { message?: string } | null)?.message;
  return message && message.length < 200
    ? message
    : "The App Store couldn’t complete that. Try again in a moment.";
}
