/**
 * Marks a page as private for PostHog (lib/posthog.ts): recordings show no
 * text, images, audio or video inside it, and clicks carry no element text.
 * `display: contents` keeps it out of the layout.
 */
export function PrivateArea({ children }: { children: React.ReactNode }) {
  return (
    <div className="ph-mask ph-sensitive" style={{ display: "contents" }}>
      {children}
    </div>
  );
}
