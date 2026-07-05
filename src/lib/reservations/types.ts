/** Dates are ISO strings, YYYY-MM-DD. checkOut is exclusive (departure day). */
export type ReservationStatus = "confirmed" | "cancelled";

export interface Reservation {
  id: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  totalYen: number;
  status: ReservationStatus;
  createdAt: string; // ISO datetime
}

export type NewReservation = Omit<Reservation, "id" | "status" | "createdAt">;

/**
 * The storage contract the whole UI talks to.
 * Swap implementations (localStorage ⇄ Supabase) without touching any page.
 */
export interface ReservationStore {
  list(): Promise<Reservation[]>;
  get(id: string): Promise<Reservation | null>;
  create(input: NewReservation): Promise<Reservation>;
  cancel(id: string): Promise<void>;
  /** Every occupied date (YYYY-MM-DD) across confirmed reservations. Checkout day excluded. */
  bookedDates(): Promise<Set<string>>;
}
