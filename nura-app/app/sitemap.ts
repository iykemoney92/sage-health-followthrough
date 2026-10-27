import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { TOOLS } from "@/lib/tools";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";

// Only the pages that answer before sign-in. Everything behind PROTECTED_PREFIXES
// in middleware.ts redirects a crawler, so listing it would only teach search
// engines that the sitemap points at redirects.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${appUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/data-use`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/delete-account`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${appUrl}/guides`, changeFrequency: "monthly", priority: 0.7 },
    ...GUIDES.map((guide) => ({
      url: `${appUrl}/guides/${guide.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...TOOLS.map((tool) => ({
      url: `${appUrl}/tools/${tool.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
