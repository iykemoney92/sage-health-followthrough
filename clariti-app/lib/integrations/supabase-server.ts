import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function hasSupabaseBrowserConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase browser environment variables are not configured.");
  }

  return { url, anonKey };
}

export async function getSupabaseSessionClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseBrowserConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies; middleware refreshes sessions.
        }
      },
    },
  });
}

export async function getSessionUser() {
  if (!hasSupabaseBrowserConfig()) return null;

  const supabase = await getSupabaseSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
