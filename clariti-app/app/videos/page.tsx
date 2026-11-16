import type { Metadata } from "next";
import Link from "next/link";
import { ClaritiShell } from "@/components/clariti-shell";
import { VIDEOS } from "@/lib/content/videos";
import { GuideFoot } from "../guides/guide-parts";
import "../guides/guides.css";

export const dynamic = "force-static";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://useclariti.app";

export const metadata: Metadata = {
  title: "Clariti videos: see a medical bill explained",
  description: "Watch Clariti explain a medical bill line by line, and a 30-second tour of what it does with bills, EOBs and scan reports.",
  alternates: { canonical: "/videos" },
};

export default function VideosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Clariti videos",
    url: `${appUrl}/videos`,
    hasPart: VIDEOS.map((video) => ({ "@type": "VideoObject", name: video.title, url: `${appUrl}/videos/${video.slug}` })),
  };

  return (
    <ClaritiShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="guide-page">
        <p className="clariti-kicker">VIDEOS</p>
        <h1>See Clariti at work</h1>
        <p className="guide-lead">
          Short videos of the real app, made with an invented bill and an invented scan report — nobody’s real paperwork.
        </p>
        <ul className="guide-video-list">
          {VIDEOS.map((video) => (
            <li key={video.slug}>
              <Link href={`/videos/${video.slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={video.poster} alt="" width={video.width} height={video.height} loading="lazy" />
                <b>{video.title}</b>
                <small>{video.description}</small>
              </Link>
            </li>
          ))}
        </ul>
        <GuideFoot invented />
      </article>
    </ClaritiShell>
  );
}
