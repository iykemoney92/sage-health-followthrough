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
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const file = path.join(__dirname, "..", ".env.local");
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
  const siteUrl = (env.NEXT_PUBLIC_APP_URL || "https://useclariti.app").replace(/\/$/, "");

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
    `${siteUrl}/**`,
    `${siteUrl}/auth/confirm`,
    `${siteUrl}/auth/callback`,
    "http://localhost:3000/**",
    "http://localhost:3000/auth/confirm",
    "http://localhost:3001/**",
    "http://localhost:3001/auth/confirm",
    "https://clariti-health-followthrough.vercel.app/**",
    "https://clariti-health-followthrough.vercel.app/auth/confirm",
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

  const body = await res.text();
  console.log("status", res.status);
  console.log(body);
  if (!res.ok) process.exit(1);
  console.log(`Clariti Auth Site URL → ${siteUrl}`);
  console.log("Supabase Auth SMTP now points at Resend as Clariti.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
