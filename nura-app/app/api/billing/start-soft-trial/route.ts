import { NextResponse } from "next/server";

/**
 * Soft (no-card) trials are disabled. Plus requires a card-linked Checkout trial
 * or a verified RevenueCat entitlement.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "soft_trial_disabled",
      message: "Start Plus with a card trial from the paywall — free soft trials are no longer available.",
    },
    { status: 410 },
  );
}
