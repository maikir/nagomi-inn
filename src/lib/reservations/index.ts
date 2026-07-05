import type { ReservationStore } from "./types";
import { LocalReservationStore } from "./localStore";
import { SupabaseReservationStore } from "./supabaseStore";

export * from "./types";
export * from "./dates";

let store: ReservationStore | null = null;

/**
 * Store factory. Uses Supabase automatically once
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are set;
 * falls back to browser localStorage otherwise (current demo mode).
 * (The Supabase SDK itself is loaded lazily, only when actually used.)
 */
export function getReservationStore(): ReservationStore {
  if (store) return store;
  store =
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? new SupabaseReservationStore()
      : new LocalReservationStore();
  return store;
}
