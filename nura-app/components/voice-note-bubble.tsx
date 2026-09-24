"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/integrations/supabase-browser";
import { VOICE_NOTES_BUCKET } from "@/lib/voice-notes";

type Props = {
  /** Object path in the voice-notes bucket - present once the note has been sent. */
  storagePath?: string;
  /** Blob URL from the recorder - lets the note play instantly before the upload settles. */
  localUrl?: string;
  /** Measured by the recorder; webm/opus from MediaRecorder reports Infinity for duration. */
  durationMs?: number | null;
  /** What speech-to-text heard, shown on demand under the player. */
  transcript?: string;
};

export function formatVoiceClock(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * WhatsApp-style voice note: play/pause, a scrubbable progress bar, and the running time.
 *
 * The audio URL is resolved lazily on first play. Notes live in a private bucket, so playback
 * goes through a short-lived signed URL minted under the owner's own SELECT policy - nothing
 * here needs the server, and a note someone else uploaded simply fails to resolve.
 */
export function VoiceNoteBubble({ storagePath, localUrl, durationMs, transcript }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // A note sent from this device keeps its blob URL after the upload; the storage path only
  // matters once the page is reopened. Prefer whichever is already usable.
  const [src, setSrc] = useState<string | null>(localUrl ?? null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [knownDurationMs, setKnownDurationMs] = useState(durationMs ?? 0);
  const [error, setError] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    const onTime = () => setPositionMs(element.currentTime * 1000);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setPositionMs(0);
    };
    const onMeta = () => {
      if (Number.isFinite(element.duration) && element.duration > 0) {
        setKnownDurationMs(element.duration * 1000);
      }
    };
    element.addEventListener("timeupdate", onTime);
    element.addEventListener("play", onPlay);
    element.addEventListener("pause", onPause);
    element.addEventListener("ended", onEnded);
    element.addEventListener("loadedmetadata", onMeta);
    return () => {
      element.removeEventListener("timeupdate", onTime);
      element.removeEventListener("play", onPlay);
      element.removeEventListener("pause", onPause);
      element.removeEventListener("ended", onEnded);
      element.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  async function resolveSource(): Promise<string | null> {
    if (src) return src;
    if (!storagePath) return null;
    setLoading(true);
    try {
      const { data, error: signError } = await getSupabaseBrowserClient()
        .storage.from(VOICE_NOTES_BUCKET)
        .createSignedUrl(storagePath, 60 * 60);
      if (signError || !data?.signedUrl) throw signError ?? new Error("no signed url");
      setSrc(data.signedUrl);
      return data.signedUrl;
    } catch {
      setError("Couldn't load this voice note.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function toggle() {
    const element = audioRef.current;
    if (!element) return;
    setError("");
    if (playing) {
      element.pause();
      return;
    }
    const url = await resolveSource();
    if (!url) return;
    if (element.src !== url) element.src = url;
    try {
      await element.play();
    } catch {
      setError("Couldn't play this voice note.");
    }
  }

  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const element = audioRef.current;
    if (!element || !src || knownDurationMs <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    element.currentTime = (ratio * knownDurationMs) / 1000;
    setPositionMs(ratio * knownDurationMs);
  }

  const progress = knownDurationMs > 0 ? Math.min(1, positionMs / knownDurationMs) : 0;
  const clock = playing || positionMs > 0 ? positionMs : knownDurationMs;

  return (
    <div className="voice-note-wrap">
      <div className="voice-note" aria-label="Voice note">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-label={playing ? "Pause voice note" : "Play voice note"}
        >
          {loading ? <Loader2 className="spin" /> : playing ? <Pause /> : <Play />}
        </button>
        <div
          className="voice-note-track"
          role="slider"
          aria-label="Voice note position"
          aria-valuemin={0}
          aria-valuemax={Math.round(knownDurationMs / 1000)}
          aria-valuenow={Math.round(positionMs / 1000)}
          onClick={seek}
        >
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="voice-note-time">{formatVoiceClock(clock)}</span>
        <audio ref={audioRef} preload="none" />
      </div>
      {error && <p className="voice-note-error">{error}</p>}
      {transcript && (
        <>
          <button type="button" className="voice-note-transcript-toggle" onClick={() => setShowTranscript((open) => !open)}>
            {showTranscript ? "Hide transcript" : "Transcript"}
          </button>
          {showTranscript && <p className="voice-note-transcript">{transcript}</p>}
        </>
      )}
    </div>
  );
}
