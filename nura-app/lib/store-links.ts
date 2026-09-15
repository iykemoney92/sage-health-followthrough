/**
 * Where the native apps live. Both have env overrides so a store URL can be
 * changed without a deploy (a renamed listing, a regional storefront).
 */
export const IOS_APP_STORE_URL =
  process.env.NEXT_PUBLIC_IOS_APP_STORE_URL?.trim() || "https://apps.apple.com/app/id6804203569";

export const ANDROID_PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_ANDROID_PLAY_STORE_URL?.trim() ||
  "https://play.google.com/store/apps/details?id=app.usenura.mobile";
