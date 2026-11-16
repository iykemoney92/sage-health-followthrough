import { describe, expect, it } from "vitest";
import { detectInAppBrowser, externalBrowserUrl } from "./in-app-browser";

// Real user agents: the TikTok one is from the 13 Nov Nura promote.
const TIKTOK_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-F711N Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.8078.47 Mobile Safari/537.36 trill_46.9.3";
const TIKTOK_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_37.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/GB";
const INSTAGRAM_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101 (iPhone15,3; iOS 18_1; en_GB; en; scale=3.00; 1290x2796; 653393960)";
const FACEBOOK_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240905.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/484.0.0.53.109;]";
const ANDROID_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36";
const IOS_WKWEBVIEW =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

describe("detectInAppBrowser", () => {
  it("names TikTok on Android and iOS", () => {
    expect(detectInAppBrowser(TIKTOK_ANDROID)).toEqual({ app: "TikTok", platform: "android" });
    expect(detectInAppBrowser(TIKTOK_IOS)).toEqual({ app: "TikTok", platform: "ios" });
  });

  it("names Instagram and Facebook", () => {
    expect(detectInAppBrowser(INSTAGRAM_IOS)).toEqual({ app: "Instagram", platform: "ios" });
    expect(detectInAppBrowser(FACEBOOK_ANDROID)).toEqual({ app: "Facebook", platform: "android" });
  });

  it("catches unnamed web views", () => {
    expect(detectInAppBrowser(ANDROID_WEBVIEW)).toEqual({ app: null, platform: "android" });
    expect(detectInAppBrowser(IOS_WKWEBVIEW)).toEqual({ app: null, platform: "ios" });
  });

  it("leaves real browsers alone", () => {
    for (const ua of [CHROME_ANDROID, SAFARI_IOS, CHROME_IOS, DESKTOP_CHROME, "", null, undefined]) {
      expect(detectInAppBrowser(ua)).toBeNull();
    }
  });
});

describe("externalBrowserUrl", () => {
  const href = "https://usenura.app/signup?utm_source=tiktok&next=%2Ftoday";

  it("builds a Chrome intent with a fallback on Android", () => {
    expect(externalBrowserUrl(href, "android")).toBe(
      "intent://usenura.app/signup?utm_source=tiktok&next=%2Ftoday#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fusenura.app%2Fsignup%3Futm_source%3Dtiktok%26next%3D%252Ftoday;end",
    );
  });

  it("uses the Safari scheme on iOS", () => {
    expect(externalBrowserUrl(href, "ios")).toBe(`x-safari-${href}`);
  });

  it("returns null where there is no scheme, or for non-https pages", () => {
    expect(externalBrowserUrl(href, "other")).toBeNull();
    expect(externalBrowserUrl("http://localhost:3000/signup", "android")).toBeNull();
    expect(externalBrowserUrl("not a url", "ios")).toBeNull();
  });
});
