import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { TOOLS } from "@/lib/tools";
import { VIDEOS } from "@/lib/videos";

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
    { url: `${appUrl}/faq`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${appUrl}/videos`, changeFrequency: "monthly", priority: 0.6 },
    ...VIDEOS.map((video) => ({
      url: `${appUrl}/videos/${video.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      videos: [
        {
          title: video.title,
          thumbnail_loc: `${appUrl}${video.poster}`,
          description: video.description,
          content_loc: `${appUrl}${video.src}`,
          ...(video.youtubeId ? { player_loc: `https://www.youtube.com/embed/${video.youtubeId}` } : {}),
          duration: video.seconds,
          publication_date: `${video.uploadDate}T12:00:00+00:00`,
          family_friendly: "yes" as const,
        },
      ],
    })),
    { url: `${appUrl}/guides`, changeFrequency: "monthly", priority: 0.7 },
    ...GUIDES.map((guide) => ({
      url: `${appUrl}/guides/${guide.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${appUrl}/tools`, changeFrequency: "monthly", priority: 0.6 },
    ...TOOLS.map((tool) => ({
      url: `${appUrl}/tools/${tool.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
