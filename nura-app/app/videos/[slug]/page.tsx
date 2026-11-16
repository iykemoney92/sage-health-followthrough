import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { StoreBadges } from "@/components/store-badges";
import { TrackedLink } from "@/components/tracked-link";
import { GUIDE_UTM, getGuide } from "@/lib/guides";
import { VIDEOS, formatClock, getVideo, isoDuration } from "@/lib/videos";
import { GuideChrome } from "../../guides/guide-chrome";
import { VideoPlayer } from "../video-player";

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "https://usenura.app";

export const dynamicParams = false;

export function generateStaticParams() {
  return VIDEOS.map((video) => ({ slug: video.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const video = getVideo(slug);
  if (!video) return { title: "Video not found" };
  const path = `/videos/${video.slug}`;
  return {
    title: video.seoTitle,
    description: video.description,
    alternates: { canonical: path },
    openGraph: {
      url: path,
      title: video.title,
      description: video.description,
      type: "video.other",
      images: [{ url: video.poster, width: video.width, height: video.height }],
      videos: [{ url: video.src, width: video.width, height: video.height, type: "video/mp4" }],
    },
    twitter: { card: "summary_large_image", title: video.title, description: video.description, images: [video.poster] },
  };
}

/** The visible transcript as one string, reused in the JSON-LD so both say the same thing. */
function transcriptText(video: NonNullable<ReturnType<typeof getVideo>>) {
  return video.scenes
    .map((scene) => [scene.spoken, scene.onScreen && !video.hasVoice ? scene.onScreen : null].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");
}

export default async function VideoPage({ params }: Props) {
  const { slug } = await params;
  const video = getVideo(slug);
  if (!video) notFound();

  const url = `${appUrl}/videos/${video.slug}`;
  const signupHref = `/signup?${GUIDE_UTM.replace("utm_content=guide", `utm_content=video_${video.slug}`)}`;
  const guides = video.guides.map((g) => getGuide(g)).filter((g): g is NonNullable<typeof g> => Boolean(g));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "VideoObject",
        "@id": `${url}#video`,
        name: video.title,
        description: video.description,
        thumbnailUrl: [`${appUrl}${video.poster}`],
        uploadDate: `${video.uploadDate}T12:00:00+00:00`,
        duration: isoDuration(video.seconds),
        contentUrl: `${appUrl}${video.src}`,
        ...(video.youtubeId ? { embedUrl: `https://www.youtube.com/embed/${video.youtubeId}` } : {}),
        width: video.width,
        height: video.height,
        inLanguage: "en",
        transcript: transcriptText(video),
        publisher: { "@type": "Organization", name: "Zapx Labs", url: "https://zapxlabs.com" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Nura", item: `${appUrl}/` },
          { "@type": "ListItem", position: 2, name: "Videos", item: `${appUrl}/videos` },
          { "@type": "ListItem", position: 3, name: video.title, item: url },
        ],
      },
    ],
  };

  return (
    <GuideChrome placement="video" signupHref={signupHref} active="videos">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <main className="guide-main">
        <nav className="guide-crumbs" aria-label="Breadcrumb">
          <Link href="/">Nura</Link>
          <span aria-hidden="true">/</span>
          <Link href="/videos">Videos</Link>
          <span aria-hidden="true">/</span>
          <span>{video.title}</span>
        </nav>
        <article>
          <span className="guide-kicker">Video · {formatClock(video.seconds)}</span>
          <h1>{video.title}</h1>
          <p className="guide-answer">{video.summary}</p>

          <VideoPlayer video={video} />

          <section className="guide-section" aria-labelledby="transcript-heading">
            <h2 id="transcript-heading">Transcript</h2>
            {!video.hasVoice && (
              <p className="video-transcript-note">No voice-over: this is the on-screen text, with what each scene shows.</p>
            )}
            <ol className="video-transcript">
              {video.scenes.map((scene) => (
                <li key={scene.at}>
                  <span className="video-time">{formatClock(scene.at)}</span>
                  <div>
                    {scene.spoken && <p className="video-spoken">&ldquo;{scene.spoken}&rdquo;</p>}
                    {scene.onScreen && (
                      <p className="video-onscreen">
                        <b>On screen:</b> {scene.onScreen}
                      </p>
                    )}
                    <p className="video-shows">{scene.shows}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {guides.length > 0 && (
            <section className="guide-section" aria-labelledby="video-guides-heading">
              <h2 id="video-guides-heading">Related guides</h2>
              <ul className="guide-related">
                {guides.map((guide) => (
                  <li key={guide.slug}>
                    <Link href={`/guides/${guide.slug}`}>
                      <b>{guide.question}</b>
                      <small>{guide.description}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="guide-nura" aria-labelledby="video-start-heading">
            <h2 id="video-start-heading">Try Nura</h2>
            <p>
              Nura is an AI health and wellbeing companion. It keeps a simple Care plan and checks in at the times that
              suit you. Questions? See the <Link href="/faq">FAQ</Link>.
            </p>
            <div className="guide-nura-actions">
              <TrackedLink
                href={signupHref}
                className="guide-button"
                event="guide_cta_click"
                eventParams={{ cta: "get_started", placement: "video_body", guide: `video_${video.slug}` }}
              >
                Get started with Nura <ArrowRight size={16} />
              </TrackedLink>
              <StoreBadges placement="video_body" compact utmContent="video" />
            </div>
          </section>
        </article>
        <p className="guide-all">
          <Link href="/videos">All videos →</Link>
        </p>
      </main>
    </GuideChrome>
  );
}
