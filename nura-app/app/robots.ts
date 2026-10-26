import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";

// Everyone, AI crawlers included, may read the public pages. The disallowed paths
// are the signed-in app, auth flows and the API: a crawler only ever sees a
// redirect there, and none of it should be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dev/",
        "/today",
        "/plans",
        "/calendar",
        "/me",
        "/workspace",
        "/check-in",
        "/summary",
        "/notifications",
        "/onboarding",
        "/billing",
        "/upload-review",
        "/thread-proposal",
        "/account",
        "/ai-consent",
        "/agree",
        "/update-password",
        "/r/",
        "/join/",
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
