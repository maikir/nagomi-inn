import type { NewReservation, Reservation, ReservationStore } from "./types";
import { nightsOf } from "./dates";

/**
 * Supabase (Postgres) implementation — ready to switch on.
 *
 * To go live:
 *   1. Create a Supabase project and run supabase/schema.sql in the SQL editor.
 *   2. `npm install @supabase/supabase-js` (already in package.json).
 *   3. Set in .env.local (and on Vercel):
 *        NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *        NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 *   4. That's it — the store factory (index.ts) picks this class up automatically
 *      when both env vars are present.
 */

type SupabaseClient = import("@supabase/supabase-js").SupabaseClient;

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
  private clientPromise: Promise<SupabaseClient> | null = null;

  private client(): Promise<SupabaseClient> {
    if (!this.clientPromise) {
      this.clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
        createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        ),
      );
    }
    return this.clientPromise;
  }

  async list(): Promise<Reservation[]> {
    const supabase = await this.client();
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .order("check_in", { ascending: true });
    if (error) throw error;
    return (data as Row[]).map(toReservation);
  }

  async get(id: string): Promise<Reservation | null> {
    const supabase = await this.client();
    const { data, error } = await supabase.from("reservations").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toReservation(data as Row) : null;
  }

  async create(input: NewReservation): Promise<Reservation> {
    const supabase = await this.client();
    const { data, error } = await supabase
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
      })
      .select()
      .single();
    if (error) {
      // 23P01 = exclusion constraint violation (overlapping stay) — see schema.sql
      if ((error as { code?: string }).code === "23P01") throw new Error("UNAVAILABLE");
      throw error;
    }
    return toReservation(data as Row);
  }

  async cancel(id: string): Promise<void> {
    const supabase = await this.client();
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);
    if (error) throw error;
  }

  async bookedDates(): Promise<Set<string>> {
    const supabase = await this.client();
    const { data, error } = await supabase
      .from("reservations")
      .select("check_in, check_out")
      .eq("status", "confirmed");
    if (error) throw error;
    const taken = new Set<string>();
    for (const row of data as Pick<Row, "check_in" | "check_out">[]) {
      for (const night of nightsOf(row.check_in, row.check_out)) taken.add(night);
    }
    return taken;
  }
}
