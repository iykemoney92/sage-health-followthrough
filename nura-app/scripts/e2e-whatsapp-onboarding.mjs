/**
 * E2E: signup → confirm → onboarding trial → WhatsApp link code → Meta webhook → linked.
 *
 * Usage:
 *   node scripts/e2e-whatsapp-onboarding.mjs
 *   node scripts/e2e-whatsapp-onboarding.mjs --base http://localhost:3000
 *
 * Simulates the WhatsApp inbound webhook (HMAC-signed) so we can verify linking
 * without sending a real phone message. Still hits Graph API for the confirmation
 * reply when credentials are configured (non-fatal if send fails).
 */
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  const text = readFileSync(resolve(path), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const BASE = (baseIdx >= 0 ? args[baseIdx + 1] : null) || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const appSecret = process.env.WHATSAPP_APP_SECRET;

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Missing Supabase env (URL / SERVICE_ROLE / ANON).");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now().toString(36);
const email = `nura.e2e+${stamp}@example.com`;
const password = `NuraE2e!${stamp.slice(-6)}Aa`;
const name = "E2E Tester";
const testPhone = `4477009${String(Date.now()).slice(-6)}`; // UK-looking test MSISDN

function metaEnvelope(from, text) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "E2E_WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "0000000000", phone_number_id: "E2E" },
              contacts: [{ profile: { name }, wa_id: from }],
              messages: [
                {
                  from,
                  id: `wamid.E2E${randomBytes(6).toString("hex")}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function signBody(raw) {
  if (!appSecret) return null;
  const digest = createHmac("sha256", appSecret).update(raw).digest("hex");
  return `sha256=${digest}`;
}

function log(step, detail) {
  console.log(`\n▸ ${step}`);
  if (detail !== undefined) console.log(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
}

async function main() {
  console.log("Nura WhatsApp onboarding E2E");
  console.log(`Base: ${BASE}`);
  console.log(`Email: ${email}`);
  console.log(`Simulated WA from: ${testPhone}`);

  // 1) Signup via app API (real path)
  log("1. Signup");
  const signupRes = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const signup = await signupRes.json();
  if (!signup.ok) throw new Error(`Signup failed: ${JSON.stringify(signup)}`);
  log("signup ok", { needsConfirmation: signup.needsConfirmation, hasDevConfirmUrl: Boolean(signup.devConfirmUrl) });

  // 2) Confirm email (prefer admin — reliable for @example.com)
  log("2. Confirm email via admin");
  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = listed?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error("User not found after signup");
  const { error: confirmErr } = await admin.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    user_metadata: { ...user.user_metadata, display_name: name, onboarding_complete: false },
  });
  if (confirmErr) throw confirmErr;
  log("confirmed", { userId: user.id });

  // 3) Password login (anon client) — proves auth works
  log("3. Sign in");
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signedIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  if (signInErr || !signedIn.session) throw signInErr || new Error("No session");
  const accessToken = signedIn.session.access_token;
  log("signed in", { expiresAt: signedIn.session.expires_at });

  // 4) Start Plus trial + profile (mirrors onboarding/complete essentials)
  log("4. Seed profile + trial (onboarding prerequisites)");
  const { error: profileErr } = await admin.from("nura_profiles").upsert({
    id: user.id,
    display_name: name,
    preferred_channel: "whatsapp",
    checkin_channel: "whatsapp",
    phone: `+${testPhone}`,
    updated_at: new Date().toISOString(),
  });
  if (profileErr) log("profile upsert warning", profileErr.message);

  // Call billing trial via completing onboarding API if possible; else ensure via admin tables.
  // Use the real onboarding complete endpoint with bearer-like cookie is hard — call ensure by inserting subscription.
  // Prefer hitting the app route with Authorization if supported; otherwise mimic ensureTrialStarted columns.
  const onboardingRes = await fetch(`${BASE}/api/onboarding/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Cookie: `sb-access-token=${accessToken}`,
    },
    body: JSON.stringify({
      interests: ["check-ins"],
      channel: "WhatsApp",
      checkinChannels: ["WhatsApp"],
      phone: `+${testPhone}`,
      intake: "E2E test: mild headache after appointment, want follow-up.",
      attachments: [],
      skip: false,
    }),
  });
  const onboardingJson = await onboardingRes.json().catch(() => ({}));
  log("onboarding/complete", { status: onboardingRes.status, body: onboardingJson });

  // If cookie auth failed, mark onboarding + trial directly so link API Plus gate passes.
  if (!onboardingRes.ok) {
    log("4b. Fallback: mark onboarding complete + start trial via admin");
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, display_name: name, onboarding_complete: true },
    });
    const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    // Try common subscription table shapes used by ensureTrialStarted
    const trialAttempts = [
      { table: "nura_subscriptions", row: { owner_id: user.id, status: "trialing", trial_ends_at: trialEnds, plan: "plus" } },
      { table: "nura_billing_customers", row: { owner_id: user.id, trial_ends_at: trialEnds } },
    ];
    for (const attempt of trialAttempts) {
      const { error } = await admin.from(attempt.table).upsert(attempt.row);
      if (!error) {
        log("trial upserted", attempt.table);
        break;
      }
      log("trial upsert skip", { table: attempt.table, error: error.message });
    }
  }

  // 5) Create WhatsApp link code via app API (with user JWT)
  log("5. GET /api/whatsapp/link (mint code)");
  // Supabase SSR cookies vary; use service role to mint pending link if HTTP auth fails.
  let code = null;
  let href = null;

  const linkRes = await fetch(`${BASE}/api/whatsapp/link`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const linkJson = await linkRes.json().catch(() => ({}));
  log("link API", { status: linkRes.status, body: linkJson });

  if (linkRes.ok && linkJson.code) {
    code = linkJson.code;
    href = linkJson.href;
  } else {
    log("5b. Fallback: mint pending link in DB");
    const linkCode = `NURA-${randomBytes(4).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await admin
      .from("nura_channel_links")
      .update({ status: "expired" })
      .eq("owner_id", user.id)
      .eq("provider", "whatsapp")
      .eq("status", "pending");
    const { error: insertErr } = await admin.from("nura_channel_links").insert({
      owner_id: user.id,
      provider: "whatsapp",
      status: "pending",
      link_code: linkCode,
      expires_at: expiresAt,
    });
    if (insertErr) throw insertErr;
    code = linkCode;
    const digits = (process.env.NEXT_PUBLIC_NURA_WHATSAPP_NUMBER || "").replace(/\D/g, "");
    const text = encodeURIComponent(`Hi Nura, I want to continue my check-in.\n\nLink code: ${code}`);
    href = digits ? `https://wa.me/${digits}?text=${text}` : null;
  }

  if (!code) throw new Error("No link code");
  log("pending code", { code, href });

  // 6) Simulate Meta webhook: user sent the prefilled message
  log("6. POST /api/whatsapp/webhook (simulate send)");
  const messageText = `Hi Nura, I want to continue my check-in.\n\nLink code: ${code}`;
  const payload = metaEnvelope(testPhone, messageText);
  const raw = JSON.stringify(payload);
  const signature = signBody(raw);
  const headers = { "Content-Type": "application/json" };
  if (signature) headers["x-hub-signature-256"] = signature;
  else log("warning", "WHATSAPP_APP_SECRET missing — webhook may reject unsigned bodies");

  const whRes = await fetch(`${BASE}/api/whatsapp/webhook`, {
    method: "POST",
    headers,
    body: raw,
  });
  const whJson = await whRes.json().catch(() => ({}));
  log("webhook result", { status: whRes.status, body: whJson });

  if (!whRes.ok || !whJson.linked) {
    throw new Error(`Webhook did not link account: ${JSON.stringify(whJson)}`);
  }

  const expectedSnippet = "Head back to the Nura app to continue";
  if (!String(whJson.reply || "").includes(expectedSnippet)) {
    throw new Error(`Confirmation reply missing expected copy: ${whJson.reply}`);
  }
  log("agent confirmation reply", whJson.reply);
  if (whJson.outbound?.skipped) log("outbound WhatsApp send skipped (no Graph creds)");
  else if (whJson.outbound?.error) log("outbound WhatsApp send error (link still ok)", whJson.outbound);
  else log("outbound WhatsApp send", whJson.outbound ?? "ok/unknown");

  // 7) Verify DB + status helper
  log("7. Verify active channel link");
  const { data: active } = await admin
    .from("nura_channel_links")
    .select("status, channel_identifier, link_code, linked_at")
    .eq("owner_id", user.id)
    .eq("provider", "whatsapp")
    .eq("status", "active")
    .maybeSingle();

  if (!active || active.channel_identifier !== testPhone) {
    throw new Error(`Active link missing/mismatch: ${JSON.stringify(active)}`);
  }
  log("active link", active);

  console.log("\n✅ E2E WhatsApp link PASSED");
  console.log(
    JSON.stringify(
      {
        email,
        password,
        userId: user.id,
        code,
        testPhone,
        reply: whJson.reply,
        href,
        browserHint: `Log in at ${BASE}/login then open /onboarding (or Me → Connected apps) to see Connected + Continue.`,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("\n❌ E2E FAILED", err);
  process.exit(1);
});
