import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/content/guides";
import { TOPICS } from "@/lib/content/topics";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://useclariti.app";

// Only the pages that answer before sign-in. Everything behind PROTECTED_PREFIXES
// in proxy.ts redirects a crawler to "/", so listing it would only teach search
// engines that the sitemap points at redirects.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${appUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/example`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${appUrl}/guides`, changeFrequency: "monthly", priority: 0.7 },
    ...[...GUIDES, ...TOPICS].map((guide) => ({
      url: `${appUrl}/guides/${guide.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${appUrl}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/delete-account`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
