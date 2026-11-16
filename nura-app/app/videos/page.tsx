import type { Metadata } from "next";
import Link from "next/link";
import { VIDEOS, formatClock } from "@/lib/videos";
import { GuideChrome } from "../guides/guide-chrome";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";
const title = "Nura videos: see the wellbeing companion";
const description =
  "Short videos of Nura, the AI health and wellbeing companion: how it checks in on you, and how it can check in on someone you care for. Each has a full transcript.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/videos" },
  openGraph: { url: "/videos", title, description, type: "website" },
};

export default function VideosIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${appUrl}/videos#page`,
    url: `${appUrl}/videos`,
    name: title,
    description,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: VIDEOS.map((video, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${appUrl}/videos/${video.slug}`,
        name: video.title,
      })),
    },
  };
  return (
    <GuideChrome placement="videos" active="videos">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="guide-main">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/">Nura</Link>
          <span aria-hidden="true">/</span>
          <span>Videos</span>
        </nav>
        <span className="guide-kicker">Videos</span>
        <h1>See Nura in action</h1>
        <p className="guide-lead">
          Short videos of Nura, the AI health and wellbeing companion that checks in on you. Each one has a full
          transcript. For written answers, see the <Link href="/faq">FAQ</Link> and the <Link href="/guides">guides</Link>.
        </p>
        <ul className="video-index">
          {VIDEOS.map((video) => (
            <li key={video.slug}>
              <Link href={`/videos/${video.slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.poster} alt="" width={video.width} height={video.height} loading="lazy" />
                <span>
                  <b>{video.title}</b>
                  <small>
                    {formatClock(video.seconds)} · {video.description}
                  </small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </GuideChrome>
  );
}
