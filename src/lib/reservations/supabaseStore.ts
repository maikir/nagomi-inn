import type { NewReservation, Reservation, ReservationStore } from "./types";
import { nightsOf } from "./dates";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Supabase (Postgres) implementation — active once NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are set (see supabase/schema.sql for the
 * database side). Reservations require a signed-in user; RLS scopes reads and
 * cancellations to the reservation's owner. Availability comes from the
 * public `booked_ranges` view (dates only).
 */

type Row = {
  id: string;
  check_in: string;
  check_out: string;
  guests: number;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  total_yen: number;
  status: "confirmed" | "cancelled";
  created_at: string;
};

function toReservation(row: Row): Reservation {
  return {
    id: row.id,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guests: row.guests,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    notes: row.notes ?? undefined,
    totalYen: row.total_yen,
    status: row.status,
    createdAt: row.created_at,
  };
}

export class SupabaseReservationStore implements ReservationStore {
  private client() {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured");
    return supabase;
  }

  async list(): Promise<Reservation[]> {
    const { data, error } = await this.client()
      .from("reservations")
      .select("*")
      .order("check_in", { ascending: true });
    if (error) throw error;
    return (data as Row[]).map(toReservation);
  }

  async get(id: string): Promise<Reservation | null> {
    const { data, error } = await this.client()
      .from("reservations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toReservation(data as Row) : null;
  }

  async create(input: NewReservation): Promise<Reservation> {
    const { data, error } = await this.client()
      .from("reservations")
      .insert({
        check_in: input.checkIn,
        check_out: input.checkOut,
        guests: input.guests,
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
        total_yen: input.totalYen,
        // user_id defaults to auth.uid() in the database
      })
      .select()
      .single();
    if (error) {
      const code = (error as { code?: string }).code;
      // 23P01 = exclusion constraint violation (overlapping stay)
      if (code === "23P01") throw new Error("UNAVAILABLE");
      // 42501 = RLS denied (not signed in)
      if (code === "42501") throw new Error("AUTH_REQUIRED");
      throw error;
    }
    return toReservation(data as Row);
  }

  async cancel(id: string): Promise<void> {
    const { error } = await this.client()
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) throw error;
  }

  async bookedDates(): Promise<Set<string>> {
    const { data, error } = await this.client()
      .from("booked_ranges")
      .select("check_in, check_out");
    if (error) throw error;
    const taken = new Set<string>();
    for (const row of data as Pick<Row, "check_in" | "check_out">[]) {
      for (const night of nightsOf(row.check_in, row.check_out)) taken.add(night);
    }
    return taken;
  }
}
