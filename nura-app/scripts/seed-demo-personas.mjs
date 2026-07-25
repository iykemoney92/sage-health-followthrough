import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  const envPath = resolve(path);
  const text = readFileSync(envPath, "utf8");
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local. " +
      "Add the Supabase service role key to pre-create confirmed demo accounts, or use the manual signup flow in docs/DEMO_PERSONAS.md.",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = "NuraDemo123!";
const personas = [
  {
    email: "sarah.nura.demo@example.com",
    name: "Sarah Thompson",
    channel: "whatsapp",
  },
  {
    email: "david.nura.demo@example.com",
    name: "David Carter",
    channel: "both",
  },
  {
    email: "amina.nura.demo@example.com",
    name: "Amina Yusuf",
    channel: "whatsapp",
  },
];

function avatarUrl(seed) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=e8f0e5,dde9ef,f7eadb&textColor=345c43`;
}

async function findUserByEmail(email) {
  let page = 1;
  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 1000) return null;
    page += 1;
  }
  return null;
}

async function resetPersona(persona) {
  const metadata = {
    display_name: persona.name,
    avatar_url: avatarUrl(persona.name),
    onboarding_complete: false,
  };

  const existing = await findUserByEmail(persona.email);
  const user = existing
    ? (await supabase.auth.admin.updateUserById(existing.id, {
        email: persona.email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      })).data.user
    : (await supabase.auth.admin.createUser({
        email: persona.email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      })).data.user;

  if (!user) throw new Error(`Could not create ${persona.email}`);

  await supabase.from("nura_messages").delete().eq("owner_id", user.id);
  await supabase.from("nura_appointment_summaries").delete().eq("owner_id", user.id);
  await supabase.from("nura_observations").delete().eq("owner_id", user.id);
  await supabase.from("nura_check_ins").delete().eq("owner_id", user.id);
  await supabase.from("nura_source_contexts").delete().eq("owner_id", user.id);
  await supabase.from("nura_plans").delete().eq("owner_id", user.id);

  await supabase.from("nura_profiles").upsert({
    id: user.id,
    display_name: persona.name,
    preferred_channel: persona.channel,
    interests: [],
  });

  return { email: persona.email, name: persona.name, id: user.id };
}

const results = [];
for (const persona of personas) {
  results.push(await resetPersona(persona));
}

console.table(results.map(({ name, email }) => ({ name, email, password })));
console.log("Demo personas are confirmed, reset, and ready for onboarding.");
