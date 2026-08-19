import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component; middleware refreshes the session instead
          }
        },
      },
    },
  );
}

/**
 * `supabase.auth.getUser()` round-trips to the Supabase auth server to
 * revalidate the session (not just decode the cookie) — expensive to call
 * more than once. Wrapping it in React's `cache()` dedupes it across every
 * Server Component in the same request (e.g. a bando's layout.tsx AND its
 * page.tsx both need the user, but only pay for the network call once).
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getUser();
});
