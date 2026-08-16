"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/** Finger travel needed to arm the refresh, before resistance is applied. */
const TRIGGER_DISTANCE = 70;
/** Cap on indicator travel, so a long drag doesn't run away down the screen. */
const MAX_TRAVEL = 96;
/** Indicator moves at this fraction of the finger, to feel weighted. */
const RESISTANCE = 0.45;

/**
 * Pull down at the top of a scrolling app screen to refresh.
 *
 * The native shell has no pull-to-refresh of its own — it's a browser
 * behaviour and WKWebView doesn't provide it — and the app suppresses
 * rubber-band overscroll, so a drag at the top would otherwise do nothing.
 * This supplies both the gesture and its feedback.
 *
 * router.refresh() refetches the server components instead of reloading the
 * document, so scroll position and in-memory state survive. The transition's
 * isPending is the single source of truth for "still refreshing", so the
 * spinner tracks real work rather than a timer.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [isPending, startTransition] = useTransition();

  const startY = useRef<number | null>(null);
  const active = useRef(false);
  const pullRef = useRef(0);
  // Mirrored into a ref so the touch listeners can read it without being
  // rebound every time the transition flips.
  const pendingRef = useRef(isPending);
  useEffect(() => {
    pendingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    // Coarse pointers only — on desktop a stray trackpad drag shouldn't refetch.
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const setPullDistance = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };

    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    /** A drag inside a scrolled-down list is that list's scroll, not a page pull. */
    const insideScrolledElement = (target: EventTarget | null) => {
      let node = target instanceof Element ? target : null;
      while (node && node !== document.body && node !== document.documentElement) {
        if (node.scrollTop > 0) return true;
        node = node.parentElement;
      }
      return false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (pendingRef.current || event.touches.length !== 1) return;
      if (!atTop() || insideScrolledElement(event.target)) return;
      startY.current = event.touches[0].clientY;
      active.current = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!active.current || startY.current === null) return;
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0 || !atTop()) {
        // Pulled back up, or the page began scrolling — abandon the gesture.
        active.current = false;
        setPullDistance(0);
        return;
      }
      setPullDistance(Math.min(MAX_TRAVEL, delta * RESISTANCE));
    };

    const onTouchEnd = () => {
      if (!active.current) return;
      active.current = false;
      startY.current = null;
      const armed = pullRef.current >= TRIGGER_DISTANCE * RESISTANCE;
      setPullDistance(0);
      if (armed) startTransition(() => router.refresh());
    };

    // Passive: at scrollTop 0 pulling down there's nothing to cancel, and
    // overscroll-behavior already suppresses the bounce.
    const opts = { passive: true } as const;
    window.addEventListener("touchstart", onTouchStart, opts);
    window.addEventListener("touchmove", onTouchMove, opts);
    window.addEventListener("touchend", onTouchEnd, opts);
    window.addEventListener("touchcancel", onTouchEnd, opts);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [router]);

  const visible = pull > 0 || isPending;
  const offset = isPending ? TRIGGER_DISTANCE * RESISTANCE : pull;

  return (
    <div className="pull-refresh" aria-hidden={!visible}>
      <span
        className="pull-refresh-badge"
        style={{
          transform: `translateY(${offset}px)`,
          opacity: visible ? Math.min(1, offset / 24) : 0,
        }}
      >
        <RefreshCw className={isPending ? "spin" : undefined} />
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {isPending ? "Refreshing" : ""}
      </span>
    </div>
  );
}
