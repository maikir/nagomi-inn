import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Next 14 caches server-side fetch() responses in its Data Cache, and route
 * `dynamic` settings don't reliably opt supabase-js out — which once served the
 * iCal feed (and /admin) stale bookings. Server reads of our DB must always be live.
 */
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

/**
 * Service-role client — SERVER ONLY (API routes). Bypasses RLS.
 * Never import from client components; the key must never reach the browser.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: noStoreFetch },
  });
}

/** Client that acts as the calling user (their JWT) — RLS applies. */
export function getSupabaseAsUser(accessToken: string): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` }, fetch: noStoreFetch },
  });
}
