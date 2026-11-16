import type { NuraVideo } from "@/lib/videos";

/** The video itself, at phone width for these 9:16 clips. Native controls, no autoplay. */
export function VideoPlayer({ video }: { video: NuraVideo }) {
  return (
    <figure className="video-figure">
      <video
        className="video-player"
        controls
        playsInline
        preload="metadata"
        poster={video.poster}
        width={video.width}
        height={video.height}
      >
        <source src={video.src} type="video/mp4" />
        Your browser can&apos;t play this video. The transcript below describes it in full.
      </video>
      {video.note && <figcaption>{video.note}</figcaption>}
    </figure>
  );
}
