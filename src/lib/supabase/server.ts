import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getEnv, IntegrationNotConfiguredError } from "@/lib/env";

/**
 * Supabase clients for server contexts.
 *
 * `createClient()` is request-scoped and reads the user's session from
 * cookies. `createAdminClient()` uses the service role key, bypasses row level
 * security, and must only ever be used in trusted server code — never in
 * anything reachable from a user-supplied parameter without an explicit
 * authorisation check first.
 */

function requireSupabaseEnv(): { url: string; anonKey: string } {
  const env = getEnv();
  const missing: string[] = [];
  if (!env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (missing.length > 0) throw new IntegrationNotConfiguredError("supabase", missing);

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

export async function createClient(): Promise<SupabaseClient> {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `cookies()` is read-only inside Server Components. Session refresh
          // is handled by the middleware, so ignoring this is correct rather
          // than an error worth surfacing.
        }
      },
    },
  });
}

export function createAdminClient(): SupabaseClient {
  const env = getEnv();
  const { url } = requireSupabaseEnv();

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new IntegrationNotConfiguredError("supabase", ["SUPABASE_SERVICE_ROLE_KEY"]);
  }

  return createServerClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
