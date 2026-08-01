/** Build auth links that use token_hash + verifyOtp (works across browsers; no PKCE verifier). */

export type AuthLinkType = "signup" | "email" | "magiclink" | "recovery";

export function buildTokenHashUrl(
  origin: string,
  path: "/auth/confirm" | "/update-password",
  tokenHash: string,
  type: AuthLinkType,
) {
  const url = new URL(path, origin.replace(/\/$/, "") + "/");
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  return url.toString();
}

export function confirmUrlFromGenerateLink(
  origin: string,
  properties: { hashed_token?: string | null; verification_type?: string | null; action_link?: string | null },
) {
  const tokenHash = properties.hashed_token;
  if (!tokenHash) return properties.action_link || null;
  const type = (properties.verification_type || "signup").toLowerCase() as AuthLinkType;
  const safeType: AuthLinkType =
    type === "recovery" || type === "magiclink" || type === "email" || type === "signup" ? type : "signup";
  const path = safeType === "recovery" ? "/update-password" : "/auth/confirm";
  return buildTokenHashUrl(origin, path, tokenHash, safeType);
}
