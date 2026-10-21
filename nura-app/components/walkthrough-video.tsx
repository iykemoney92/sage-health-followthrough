"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, PlayCircle, X } from "lucide-react";
import { WALKTHROUGH_LENGTH_LABEL, WALKTHROUGH_VIDEOS } from "@/lib/walkthrough";

type Variant = keyof typeof WALKTHROUGH_VIDEOS;

/** Portrait cut on phones held upright, landscape everywhere else. */
function pickVariant(): Variant {
  if (typeof window === "undefined") return "landscape";
  return window.matchMedia("(max-width: 640px) and (orientation: portrait)").matches ? "portrait" : "landscape";
}

function markSeen() {
  void fetch("/api/walkthrough/seen", { method: "POST" }).catch(() => null);
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  /** First-visit copy ("Welcome to Nura") instead of the plain replay heading. */
  welcome?: boolean;
  firstName?: string;
  onFirstPlay?: () => void;
};

export function WalkthroughModal(props: ModalProps) {
  // Mounting the dialog only while open lets it pick the video once, on the client, and keep it -
  // turning the phone mid-play doesn't swap the source and restart the video.
  return props.open ? <WalkthroughDialog {...props} /> : null;
}

function WalkthroughDialog({ onClose, welcome = false, firstName, onFirstPlay }: ModalProps) {
  const [variant] = useState<Variant>(pickVariant);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const playedRef = useRef(false);

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

  const video = WALKTHROUGH_VIDEOS[variant];
  const title = welcome ? `Welcome to Nura${firstName ? `, ${firstName}` : ""}` : "How Nura works";

  return (
    <div
      className="walkthrough-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`walkthrough-dialog is-${variant}`} role="dialog" aria-modal="true" aria-labelledby="walkthrough-title">
        <div className="walkthrough-head">
          <div>
            <span className="auth-kicker">{welcome ? "WELCOME" : "WALKTHROUGH"}</span>
            <h2 id="walkthrough-title">{title}</h2>
            <p>
              {`A ${WALKTHROUGH_LENGTH_LABEL} tour of how Nura turns what your doctor said into a plan, then checks in so the next step doesn't slip.`}
            </p>
          </div>
          <button ref={closeRef} type="button" className="walkthrough-close" onClick={onClose} aria-label="Close walkthrough">
            <X />
          </button>
        </div>
        <div className="walkthrough-frame">
          <video
            key={video.src}
            ref={videoRef}
            src={video.src}
            poster={video.poster}
            controls
            playsInline
            preload="metadata"
            onPlay={() => {
              if (playedRef.current) return;
              playedRef.current = true;
              onFirstPlay?.();
            }}
          >
            Your browser can&apos;t play this video.
          </video>
        </div>
        {welcome && (
          <div className="walkthrough-foot">
            <small>You can watch this again any time from Today or Me.</small>
            <button type="button" className="secondary-cta" onClick={onClose}>
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Pops the walkthrough once, the first time someone lands on Today. Closing it or pressing play
 * records it on the account, so it never comes back on its own - the buttons below replay it.
 */
export function WelcomeWalkthrough({ show, firstName }: { show: boolean; firstName?: string }) {
  const [open, setOpen] = useState(false);
  const recorded = useRef(false);

  const record = useCallback(() => {
    if (recorded.current) return;
    recorded.current = true;
    markSeen();
  }, []);

  useEffect(() => {
    if (!show) return;
    // A beat after first paint, so it reads as a welcome rather than a page that loaded wrong.
    const timer = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(timer);
  }, [show]);

  const close = useCallback(() => {
    setOpen(false);
    record();
  }, [record]);

  return <WalkthroughModal open={open} onClose={close} welcome firstName={firstName} onFirstPlay={record} />;
}

/** The permanent way back to the walkthrough: a quiet link on Today, a settings tile on Me. */
export function WalkthroughButton({ variant = "link" }: { variant?: "link" | "tile" }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      {variant === "tile" ? (
        <button type="button" className="me-settings-tile walkthrough-tile" onClick={() => setOpen(true)}>
          <span className="me-settings-icon">
            <PlayCircle />
          </span>
          <span className="me-settings-copy">
            <b>Watch the walkthrough</b>
            <small>A {WALKTHROUGH_LENGTH_LABEL} tour of how Nura works</small>
          </span>
          <span className="me-settings-meta">2:32</span>
          <ChevronRight className="me-settings-chevron" />
        </button>
      ) : (
        <button type="button" className="walkthrough-link" onClick={() => setOpen(true)}>
          <PlayCircle aria-hidden /> Watch the {WALKTHROUGH_LENGTH_LABEL} walkthrough
        </button>
      )}
      <WalkthroughModal open={open} onClose={close} />
    </>
  );
}
