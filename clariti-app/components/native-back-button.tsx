"use client";

import { useEffect, useRef } from "react";
import { App as CapacitorApp, type BackButtonListenerEvent } from "@capacitor/app";
import type { PluginListenerHandle } from "@capacitor/core";
import { isNativeShell } from "@/lib/analytics-consent";

/**
 * What Android's Back button should close right now, innermost last.
 *
 * Nothing in the web app registered a `backButton` listener, so the Capacitor
 * App plugin's default handler was the only thing answering the press, and it
 * only knows one trick: `webView.goBack()` when there is history, nothing at
 * all when there isn't. Neither is ever right here.
 *
 *  - With the sign-in modal, a bottom sheet or the mobile canvas open, Back
 *    navigated the WebView to the previous page *underneath* the overlay. The
 *    overlay is React state on a page that no longer exists, so the user landed
 *    somewhere else entirely with their document out of reach.
 *  - On the entry screen, with no history to go back to, the press was swallowed
 *    in silence. On Android, Back on the first screen means "leave", and an app
 *    that cannot be left that way reads as hung.
 *
 * A module-level array rather than context, because the overlays that need to
 * register are scattered across pages and none of them share a provider — and
 * because the one thing this has to get right is ordering across the whole app,
 * which a per-subtree provider cannot see.
 */
type DismissEntry = { dismiss: () => void };

const overlayStack: DismissEntry[] = [];

/**
 * Declare that something dismissable is open. Returns the unregister function,
 * so it drops straight out of a `useEffect` as the cleanup.
 *
 * No-ops on the web: browsers have their own Back, Escape already closes these
 * overlays, and a stack nobody reads is just a leak waiting to happen.
 */
export function registerDismissableOverlay(dismiss: () => void): () => void {
  if (!isNativeShell()) return () => {};

  const entry: DismissEntry = { dismiss };
  overlayStack.push(entry);

  // By identity, and idempotent: the press handler pops the entry before it
  // calls it, so the overlay's own cleanup usually finds nothing left to do.
  return () => {
    const index = overlayStack.lastIndexOf(entry);
    if (index !== -1) overlayStack.splice(index, 1);
  };
}

/**
 * Hook form, for overlays that are mounted only while they are open (the usual
 * shape here — `{open && <Modal />}`), which can leave `active` alone.
 */
export function useDismissableOverlay(onDismiss: () => void, active = true) {
  const latest = useRef(onDismiss);

  // Held in a ref, and updated in a passive effect, so call sites can pass an
  // inline arrow without re-registering on every render — and so the callback
  // that eventually runs is the current one rather than whichever closure was
  // captured when the overlay opened.
  useEffect(() => {
    latest.current = onDismiss;
  });

  useEffect(() => {
    if (!active) return;
    return registerDismissableOverlay(() => latest.current());
  }, [active]);
}

function handleBackButton({ canGoBack }: BackButtonListenerEvent) {
  const top = overlayStack.pop();

  if (top) {
    // Popped before it is called, never after. If dismissing throws, or the
    // overlay decides to stay open anyway, the entry is already gone and the
    // next press falls through to navigation. A Back button that occasionally
    // does one thing too many is much better than one that traps a user on a
    // screen it has quietly decided not to leave.
    top.dismiss();
    return;
  }

  // Nothing to close, so put back what the default handler used to do —
  // registering this listener at all is what disabled it, and without these two
  // branches Back would be dead on every screen instead of merely wrong.
  if (canGoBack) {
    // Not router.back(): this is the WebView's own history, which is what
    // `canGoBack` was measured against. Next's App Router picks the popstate up
    // and handles it as a client navigation.
    window.history.back();
    return;
  }

  void CapacitorApp.exitApp();
}

// One listener for the whole app, reference-counted rather than tied to a single
// component instance. Two listeners would pop two overlays per press, so both
// orderings that could produce one are closed off: a second mount cannot attach,
// and an unmount that overlaps the bridge call still removes what it asked for.
let subscribers = 0;
let listener: PluginListenerHandle | null = null;
let attaching = false;

function attach() {
  if (listener || attaching) return;
  attaching = true;

  void CapacitorApp.addListener("backButton", handleBackButton)
    .then((handle) => {
      attaching = false;
      // Everyone went away while the bridge call was in flight — including the
      // unmount/remount React does to every effect in development.
      if (subscribers === 0) {
        void handle.remove();
        return;
      }
      listener = handle;
    })
    .catch(() => {
      // The plugin is missing or the bridge is not up. Leaving `listener` null
      // means the default handler stays in charge: wrong, but no worse than
      // before, and a later mount gets to try again.
      attaching = false;
    });
}

function detach() {
  const handle = listener;
  listener = null;
  if (handle) void handle.remove();
  // If a call is still in flight, `attach`'s continuation sees `subscribers`
  // back at zero and removes the handle itself.
}

/**
 * Mount once, in app/layout.tsx. Renders nothing.
 *
 * Android only in practice — iOS has no hardware Back and never fires the event
 * — but guarded on the shell rather than the platform, because the web app must
 * not touch the Capacitor bridge at all.
 */
export function NativeBackButton() {
  useEffect(() => {
    if (!isNativeShell()) return;

    subscribers += 1;
    attach();

    return () => {
      subscribers -= 1;
      if (subscribers === 0) detach();
    };
  }, []);

  return null;
}
