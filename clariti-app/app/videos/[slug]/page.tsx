import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClaritiShell } from "@/components/clariti-shell";
import { VIDEOS, getVideo } from "@/lib/content/videos";
import { GuideCta, GuideFoot } from "../../guides/guide-parts";
import "../../guides/guides.css";

// Public, like /guides: not in PROTECTED_PREFIXES in proxy.ts.
export const dynamicParams = false;

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://useclariti.app";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return VIDEOS.map((video) => ({ slug: video.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const video = getVideo((await params).slug);
  if (!video) return {};
  return {
    title: video.metaTitle,
    description: video.description,
    alternates: { canonical: `/videos/${video.slug}` },
    openGraph: {
      type: "video.other",
      siteName: "Clariti",
      title: video.metaTitle,
      description: video.description,
      url: `/videos/${video.slug}`,
      images: [{ url: video.poster, width: video.width, height: video.height, alt: video.title }],
      videos: [{ url: video.src, type: "video/mp4", width: video.width, height: video.height }],
    },
  };
}

export default async function VideoPage({ params }: Props) {
  const video = getVideo((await params).slug);
  if (!video) notFound();

  const url = `${appUrl}/videos/${video.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: video.title,
      description: video.description,
      thumbnailUrl: [video.poster],
      uploadDate: video.uploadDate,
      duration: video.isoDuration,
      contentUrl: video.src,
      ...(video.youtubeId ? { embedUrl: `https://www.youtube.com/embed/${video.youtubeId}` } : {}),
      url,
      inLanguage: "en",
      publisher: { "@id": "https://zapxlabs.com/#organization", "@type": "Organization", name: "Zapx Labs", url: "https://zapxlabs.com" },
      about: { "@id": `${appUrl}/#app` },
      transcript: video.transcript.map((scene) => scene.text).join(" "),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Clariti", item: `${appUrl}/` },
        { "@type": "ListItem", position: 2, name: "Videos", item: `${appUrl}/videos` },
        { "@type": "ListItem", position: 3, name: video.title, item: url },
      ],
    },
  ];
  const others = VIDEOS.filter((other) => other.slug !== video.slug);

  return (
    <ClaritiShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="guide-page">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/videos">Videos</Link> <span aria-hidden="true">/</span> <span>{video.title.toLowerCase()}</span>
        </nav>
        <p className="clariti-kicker">VIDEO · {video.seconds < 60 ? `${video.seconds} SECONDS` : `${Math.floor(video.seconds / 60)} MIN ${video.seconds % 60} S`}</p>
        <h1>{video.title}</h1>
        <figure className="guide-video">
          <video controls playsInline preload="metadata" poster={video.poster} width={video.width} height={video.height}>
            <source src={video.src} type="video/mp4" />
            <a href={video.src}>Download the video</a>
          </video>
        </figure>
        <p className="guide-answer">{video.description}</p>
        {video.youtubeId && (
          <p>
            <a href={`https://www.youtube.com/watch?v=${video.youtubeId}`} rel="noopener" target="_blank">
              Watch on YouTube →
            </a>
          </p>
        )}

        <h2>{video.transcriptKind === "narration" ? "Transcript" : "What’s on screen"}</h2>
        {video.transcriptKind === "on-screen" && (
          <p>This video has no voice-over. Here is the text it shows, scene by scene.</p>
        )}
        <dl className="guide-faq">
          {video.transcript.map((scene, index) => (
            <div key={`${scene.heading}-${index}`}>
              <dt>{scene.heading}</dt>
              <dd>{scene.text}</dd>
            </div>
          ))}
        </dl>

        <GuideCta prompt="Got a bill, EOB or report of your own? Attach it or take a photo, and Clariti will explain it in plain language." />

        <h2>Keep reading</h2>
        <ul className="guide-related">
          {others.map((other) => (
            <li key={other.slug}>
              <Link href={`/videos/${other.slug}`}>Watch: {other.title}</Link>
            </li>
          ))}
          <li>
            <Link href="/guides/understand-your-medical-bill">How to understand a medical bill (and spot errors)</Link>
          </li>
          <li>
            <Link href="/guides/how-to-read-an-eob">How to read an explanation of benefits (EOB)</Link>
          </li>
          <li>
            <Link href="/faq">Clariti FAQ: price, privacy and how it works</Link>
          </li>
        </ul>

        <GuideFoot invented />
      </article>
    </ClaritiShell>
  );
}
