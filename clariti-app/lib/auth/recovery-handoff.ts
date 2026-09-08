"use client";

/**
 * How /auth/confirm tells /auth/reset-password that the visitor arrived on a
 * recovery link rather than walking there from Settings.
 *
 * The two entry points are authorised by different things. On the recovery leg
 * the one-time link is the whole proof, and the person following it does not
 * know the password being replaced, so asking for it would make the screen
 * unusable. Every other way in is somebody already signed in, and a live session
 * is weaker proof than it looks: Clariti sessions persist in the native WebView,
 * so a borrowed unlocked phone is one, and a password change evicts the real
 * owner. That entry asks for the current password.
 *
 * sessionStorage rather than a query parameter because a parameter is something
 * the borrower could simply type. It is not a secret and not a security boundary
 * — the server-side version of this is Supabase's "Secure password change"
 * project setting, which makes GoTrue itself require the current password.
 */
const HANDOFF_KEY = "clariti.auth.recovery-handoff";

export function markRecoveryHandoff() {
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, "1");
  } catch {
    // Private mode, or storage the browser refuses. The reset screen then asks
    // for the current password, which is wrong for a recovery visitor but shuts
    // nobody out: they can ask for a new link, and no account is exposed.
  }
}

/** Reads the marker and clears it, so one link authorises one change. */
export function consumeRecoveryHandoff() {
  try {
    const present = window.sessionStorage.getItem(HANDOFF_KEY) === "1";
    window.sessionStorage.removeItem(HANDOFF_KEY);
    return present;
  } catch {
    return false;
  }
}
