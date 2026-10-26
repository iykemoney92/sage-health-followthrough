/**
 * Tagged links for the calls to action on /guides pages, so PostHog and GA can
 * tell guide visitors apart (marketing/utm/tagged-links.md: utm_campaign=clariti_nov26,
 * utm_content=<page type>). The App Store link stays untagged: Apple campaign links
 * need a provider token, and an unknown query string is simply dropped.
 */

const UTM = "utm_source=site&utm_medium=web&utm_campaign=clariti_nov26&utm_content=guide";

export const GUIDE_APP_HREF = `/?${UTM}`;
export const GUIDE_PLAY_HREF = `https://play.google.com/store/apps/details?id=app.useclariti.mobile&referrer=${encodeURIComponent(UTM)}`;
export const APP_STORE_URL = "https://apps.apple.com/app/id6806667378";
export const RADILY_PHRASES_URL = "https://radily.ai/report-phrases";
