/**
 * Detects the browsers that apps like TikTok and Instagram open links in.
 *
 * Google refuses OAuth from embedded web views (`403 disallowed_useragent`), so
 * "Continue with Google" fails there for real people arriving from an ad or a
 * bio link. Starting the sign-in in the in-app browser and finishing it in
 * Chrome or Safari doesn't work either: the PKCE verifier lives in a cookie in
 * the in-app browser's own jar. The page has to move to the real browser first.
 *
 * The Nura native shell is also a web view, so callers must rule it out
 * (isNativeShell) before trusting a match here.
 */

export type InAppBrowser = {
  /** Name to show people ("TikTok"), or null when it's an unnamed web view. */
  app: string | null;
  platform: "android" | "ios" | "other";
};

const NAMED_APPS: Array<[RegExp, string]> = [
  [/trill_|musical_ly|BytedanceWebview|ByteLocale|TikTok/i, "TikTok"],
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS|Messenger/i, "Facebook"],
  [/Snapchat/i, "Snapchat"],
  [/LinkedInApp/i, "LinkedIn"],
  [/Pinterest/i, "Pinterest"],
  [/\bLine\//, "LINE"],
  [/MicroMessenger/i, "WeChat"],
  [/Twitter/i, "X"],
];

function platformOf(ua: string): InAppBrowser["platform"] {
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "other";
}

export function detectInAppBrowser(ua: string | null | undefined): InAppBrowser | null {
  if (!ua) return null;
  const platform = platformOf(ua);

  for (const [pattern, app] of NAMED_APPS) {
    if (pattern.test(ua)) return { app, platform };
  }

  // Unnamed Android WebView: Chrome marks it with "; wv)".
  if (platform === "android" && /; wv\)/.test(ua)) return { app: null, platform };

  // Unnamed iOS WKWebView: WebKit without the "Safari/" token that Safari,
  // Chrome (CriOS), Firefox (FxiOS) and Edge (EdgiOS) all send.
  if (platform === "ios" && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) {
    return { app: null, platform };
  }

  return null;
}

/**
 * A link that asks the phone to open `href` in its real browser, or null when
 * the platform has no such scheme (the caller then offers "Copy link").
 *
 * - Android: an intent:// URL for Chrome, falling back to the plain page.
 * - iOS 17+: the x-safari-https:// scheme opens Safari directly.
 */
export function externalBrowserUrl(href: string, platform: InAppBrowser["platform"]): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  if (platform === "android") {
    const target = `${url.host}${url.pathname}${url.search}`;
    return `intent://${target}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.toString())};end`;
  }
  if (platform === "ios") {
    return `x-safari-${url.toString()}`;
  }
  return null;
}
