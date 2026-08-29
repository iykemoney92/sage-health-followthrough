"use client";

import { Capacitor } from "@capacitor/core";
import {
  LOG_LEVEL,
  Purchases,
  type PurchasesOffering,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";

/**
 * The entitlement the rest of Clariti already keys off. The RevenueCat webhook
 * treats `entitlement_ids` containing "plus" as authoritative (see
 * lib/billing/revenuecat-webhook.ts), so a StoreKit purchase lands in
 * clariti_profiles through exactly the same path a web purchase does — there is
 * no separate backend branch for the store.
 */
export const PLUS_ENTITLEMENT = "plus";

/**
 * Apple requires In-App Purchase for digital content sold inside the app
 * (Guideline 3.1.1), so the web checkout at pay.rev.cat must not be reachable
 * from the iOS build. This module is that replacement, and it is deliberately
 * inert anywhere native purchasing isn't configured.
 */
const IOS_API_KEY = process.env.NEXT_PUBLIC_CLARITI_REVENUECAT_IOS_API_KEY?.trim();
const ANDROID_API_KEY = process.env.NEXT_PUBLIC_CLARITI_REVENUECAT_ANDROID_API_KEY?.trim();

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

/** True in the shell regardless of whether purchasing is configured yet. */
export function isNativeShell() {
  return Capacitor.isNativePlatform();
}

let configuredFor: string | null = null;

/**
 * Binds the RevenueCat SDK to the signed-in Supabase user.
 *
 * appUserID is the Supabase user id on purpose: the webhook resolves a
 * subscriber by matching app_user_id against clariti_profiles.id first, so using
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
  /** ISO 8601 duration from the store, e.g. P1M or P1Y. */
  period: string | null;
  identifier: string;
};

/**
 * Every package in the current Plus offering, priced and localised by the store.
 *
 * Apple rejects a paywall whose prices disagree with the storefront, and the same
 * product costs different amounts in different regions, so callers render
 * `priceString` verbatim rather than formatting anything themselves. Clariti sells
 * a monthly and an annual package, so this returns the list rather than Nura's
 * single offer — the paywall shows both.
 */
export async function getPlusOffers(): Promise<PlusOffer[]> {
  const { current } = (await Purchases.getOfferings()) as { current: PurchasesOffering | null };
  return (current?.availablePackages ?? []).map((entry) => ({
    package: entry,
    priceString: entry.product.priceString,
    period: entry.product.subscriptionPeriod ?? null,
    identifier: entry.identifier,
  }));
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

/**
 * Where "manage subscription" goes on a store purchase.
 *
 * RevenueCat hands back the storefront's own management URL, which for an App
 * Store purchase is the Apple subscriptions screen. Sending someone to a Stripe
 * portal for a purchase Apple processed would simply not work, and offering to
 * cancel outside the store breaks Guideline 3.1.1.
 */
export async function getNativeManagementUrl(): Promise<string | null> {
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo.managementURL ?? null;
  } catch {
    return null;
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

/** "P1M" → "month". Used only to label a package, never to compute a price. */
export function readablePeriod(period: string | null) {
  if (!period) return null;
  const match = /^P(\d+)([DWMY])$/.exec(period);
  if (!match) return null;
  const count = Number(match[1]);
  const unit = { D: "day", W: "week", M: "month", Y: "year" }[match[2]]!;
  return count === 1 ? unit : `${count} ${unit}s`;
}
