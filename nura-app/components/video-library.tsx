"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Play, X } from "lucide-react";
import { track } from "@/lib/analytics";
import { NURA_SOCIALS, NURA_VIDEOS, type NuraSocialId, type NuraVideo } from "@/lib/nura-videos";
import { WALKTHROUGH_VIDEOS } from "@/lib/walkthrough";
import { WalkthroughModal } from "@/components/walkthrough-video";

function VideoDialog({ video, onClose }: { video: NuraVideo; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      videoEl?.pause();
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="walkthrough-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="walkthrough-dialog is-portrait" role="dialog" aria-modal="true" aria-labelledby="video-title">
        <div className="walkthrough-head">
          <div>
            <span className="auth-kicker">{video.length}</span>
            <h2 id="video-title">{video.title}</h2>
            <p>{video.blurb}</p>
          </div>
          <button ref={closeRef} type="button" className="walkthrough-close" onClick={onClose} aria-label="Close video">
            <X />
          </button>
        </div>
        <div className="walkthrough-frame">
          <video ref={videoRef} src={video.src} poster={video.poster} controls playsInline autoPlay preload="metadata">
            Your browser can&apos;t play this video.
          </video>
        </div>
      </div>
    </div>
  );
}

/** Opens the full walkthrough first, then the short explainers, each in a player sheet. */
export function VideoLibrary() {
  const [playing, setPlaying] = useState<NuraVideo | null>(null);
  const [walkthroughOpen, setWalkthroughOpen] = useState(false);
  const closeVideo = useCallback(() => setPlaying(null), []);
  const closeWalkthrough = useCallback(() => setWalkthroughOpen(false), []);

  function open(video: NuraVideo) {
    track("video_opened", { video: video.id });
    setPlaying(video);
  }

  return (
    <>
      <button
        type="button"
        className="video-feature"
        onClick={() => {
          track("video_opened", { video: "walkthrough" });
          setWalkthroughOpen(true);
        }}
      >
        <span className="video-feature-thumb" style={{ backgroundImage: `url(${WALKTHROUGH_VIDEOS.landscape.poster})` }}>
          <span className="video-play" aria-hidden>
            <Play />
          </span>
        </span>
        <span className="video-feature-copy">
          <span className="auth-kicker">START HERE · 2:32</span>
          <b>The full Nura walkthrough</b>
          <small>How Nura turns what your doctor said into a plan, then checks in so the next step doesn&apos;t slip.</small>
        </span>
      </button>

      <div className="video-grid">
        {NURA_VIDEOS.map((video) => (
          <button type="button" key={video.id} className="video-card" onClick={() => open(video)}>
            <span className="video-card-thumb" style={{ backgroundImage: `url(${video.poster})` }}>
              <span className="video-play" aria-hidden>
                <Play />
              </span>
              <span className="video-length">{video.length}</span>
            </span>
            <span className="video-card-copy">
              <b>{video.title}</b>
              <small>{video.blurb}</small>
            </span>
          </button>
        ))}
      </div>

      {playing && <VideoDialog video={playing} onClose={closeVideo} />}
      <WalkthroughModal open={walkthroughOpen} onClose={closeWalkthrough} />
    </>
  );
}

function SocialMark({ id }: { id: NuraSocialId }) {
  if (id === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden focusable="false" fill="currentColor">
        <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.77.12V9.77a5.7 5.7 0 0 0-.77-.05 5.68 5.68 0 1 0 5.68 5.68V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48Z" />
      </svg>
    );
  }
  if (id === "youtube") {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden focusable="false" fill="currentColor">
        <path d="M21.6 7.2a2.5 2.5 0 0 0-1.77-1.77C18.27 5 12 5 12 5s-6.27 0-7.83.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.77 1.77C5.73 19 12 19 12 19s6.27 0 7.83-.43a2.5 2.5 0 0 0 1.77-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Links out to Nura's own accounts; renders nothing until at least one is configured. */
export function NuraSocialLinks() {
  if (NURA_SOCIALS.length === 0) return null;
  return (
    <div className="me-settings-grid">
      {NURA_SOCIALS.map((social) => (
        <a
          key={social.id}
          href={social.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`me-settings-tile social-tile social-${social.id}`}
          onClick={() => track("social_opened", { network: social.id })}
        >
          <span className="me-settings-icon">
            <SocialMark id={social.id} />
          </span>
          <span className="me-settings-copy">
            <b>Nura on {social.label}</b>
            <small>{social.handle}</small>
          </span>
          <ExternalLink className="me-settings-chevron" />
        </a>
      ))}
    </div>
  );
}
