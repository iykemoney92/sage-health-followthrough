#!/usr/bin/env node
/**
 * Configures Clariti Supabase Auth:
 * - Site URL + redirect allowlist
 * - Custom SMTP via Resend (Clariti sender name)
 *
 * Requires SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-supabase-auth.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

// Production stays on the list no matter what NEXT_PUBLIC_APP_URL happens to hold locally —
// pointing .env.local at a preview deployment must not quietly drop useclariti.app.
const PRODUCTION_URL = "https://useclariti.app";

// The Capacitor shell finishes OAuth back into the app over its custom scheme rather than over
// https, and Supabase rejects any redirect it has not been told about — so without this entry
// native sign-in dead-ends on the provider's page. Kept in sync with NATIVE_OAUTH_REDIRECT in
// lib/auth/oauth.ts.
const NATIVE_REDIRECT = "app.useclariti.mobile://auth/callback";

function loadEnv() {
  const file = path.join(scriptDir, "..", ".env.local");
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\n/)
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        const k = line.slice(0, i).trim();
        let v = line.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [k, v];
      }),
  );
}

async function main() {
  const env = loadEnv();
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = (env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const resendKey = env.RESEND_API_KEY;
  const from = env.AUTH_EMAIL_FROM || "Clariti <hello@usenura.app>";
  const adminEmail = from.match(/<([^>]+)>/)?.[1] || from;
  const siteUrl = (env.NEXT_PUBLIC_APP_URL || PRODUCTION_URL).replace(/\/$/, "");

  if (!token) {
    console.error("Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens");
    process.exit(1);
  }
  if (!projectRef) {
    console.error("Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL");
    process.exit(1);
  }
  if (!resendKey) {
    console.error("Missing RESEND_API_KEY in .env.local");
    process.exit(1);
  }

  const uriAllowList = [
    ...new Set([
      NATIVE_REDIRECT,
      `${PRODUCTION_URL}/**`,
      `${PRODUCTION_URL}/auth/confirm`,
      `${PRODUCTION_URL}/auth/callback`,
      `${siteUrl}/**`,
      `${siteUrl}/auth/confirm`,
      `${siteUrl}/auth/callback`,
      "http://localhost:3000/**",
      "http://localhost:3000/auth/confirm",
      "http://localhost:3001/**",
      "http://localhost:3001/auth/confirm",
      "https://clariti-health-followthrough.vercel.app/**",
      "https://clariti-health-followthrough.vercel.app/auth/confirm",
    ]),
  ].join(",");

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site_url: siteUrl,
      uri_allow_list: uriAllowList,
      external_email_enabled: true,
      mailer_autoconfirm: false,
      smtp_admin_email: adminEmail,
      smtp_host: "smtp.resend.com",
      smtp_port: "465",
      smtp_user: "resend",
      smtp_pass: resendKey,
      smtp_sender_name: "Clariti",
    }),
  });

  // Supabase echoes the whole auth config back, smtp_pass included, so the body never reaches
  // stdout — a terminal scrollback or a CI log would otherwise hold the live Resend key.
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    console.error(`Supabase rejected the auth config (HTTP ${res.status}).`, detail?.message ?? "");
    process.exit(1);
  }

  console.log(`Clariti Auth Site URL → ${siteUrl}`);
  console.log(`Redirect allow-list → ${uriAllowList.split(",").length} entries, including ${NATIVE_REDIRECT}`);
  console.log("Supabase Auth SMTP now points at Resend as Clariti.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
