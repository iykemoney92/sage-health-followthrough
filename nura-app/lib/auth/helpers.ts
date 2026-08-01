/** Shared auth helpers — keep signup/login/email APIs consistent. */

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/**
 * With "Confirm email" enabled, Supabase returns a fake success for existing
 * confirmed accounts: user object with identities: [].
 */
export function isObfuscatedDuplicateSignup(user: {
  identities?: Array<unknown> | null;
} | null | undefined) {
  return Boolean(user) && Array.isArray(user?.identities) && user!.identities!.length === 0;
}

export function appOriginFromRequest(request: Request) {
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (envOrigin) return envOrigin.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export function clientAppOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://usenura.app").replace(
    /\/$/,
    "",
  );
}

export const AUTH_COPY = {
  duplicateAccount: {
    title: "Account already exists",
    message: "An account with this email already exists. Sign in, or reset your password if you’ve forgotten it.",
  },
  checkEmail: {
    title: "Check your email",
    message: "We sent a confirmation link. Open it to finish creating your account.",
  },
  emailConfirmed: {
    title: "Email confirmed",
    message: "Your address is verified. Sign in to continue.",
  },
  alreadyConfirmed: {
    title: "Already confirmed",
    message: "That email is already verified. Sign in to continue.",
  },
} as const;
