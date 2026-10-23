import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://useclariti.app";

// Cloudflare prepends its content-signal comments to whatever this returns. The
// disallowed paths are the signed-in app and the API: a crawler only ever sees
// a redirect there, and none of it should be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/workspace", "/documents", "/history", "/settings", "/follow-ups", "/auth/", "/ai-consent"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
