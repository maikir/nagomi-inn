import type { NewReservation, Reservation, ReservationStore } from "./types";
import { nightsOf } from "./dates";

/**
 * Browser localStorage implementation — the current "database".
 * Reservations live only on the visitor's device. Swap for the Supabase
 * store (see supabaseStore.ts + supabase/schema.sql) when going live.
 */

const KEY = "nagomi.reservations.v1";

function readAll(): Reservation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Reservation[]) : [];
  } catch {
    return [];
  }
}

function writeAll(reservations: Reservation[]) {
  window.localStorage.setItem(KEY, JSON.stringify(reservations));
}

export class LocalReservationStore implements ReservationStore {
  async list(): Promise<Reservation[]> {
    return readAll().sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1));
  }

  async get(id: string): Promise<Reservation | null> {
    return readAll().find((r) => r.id === id) ?? null;
  }

  async create(input: NewReservation): Promise<Reservation> {
    const reservation: Reservation = {
      ...input,
      id: generateId(),
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    const all = readAll();

    // Guard against double-booking (same rule the Supabase schema enforces).
    const taken = await this.bookedDates();
    for (const night of nightsOf(input.checkIn, input.checkOut)) {
      if (taken.has(night)) throw new Error("UNAVAILABLE");
    }

    all.push(reservation);
    writeAll(all);
    return reservation;
  }

  async cancel(id: string): Promise<void> {
    const all = readAll();
    const target = all.find((r) => r.id === id);
    if (target) {
      target.status = "cancelled";
      writeAll(all);
    }
  }

  async bookedDates(): Promise<Set<string>> {
    const taken = new Set<string>();
    for (const r of readAll()) {
      if (r.status !== "confirmed") continue;
      for (const night of nightsOf(r.checkIn, r.checkOut)) taken.add(night);
    }
    return taken;
  }
}

function generateId(): string {
  // Human-friendly confirmation code, e.g. NGM-7K2F9Q
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `NGM-${code}`;
}
