import type { AmenityPlan, ArrivalTime } from "./stayPlans";

/** Dates are ISO strings, YYYY-MM-DD. checkOut is exclusive (departure day). */
/** 'pending' = dates held while payment is in progress (Stripe mode only). */
export type ReservationStatus = "pending" | "confirmed" | "cancelled";

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
  cancellationState?: "processing" | "failed" | "completed";
  /** Stay plans told to the hosts at booking (fixed once booked). */
  bbqPlan?: AmenityPlan;
  saunaPlan?: AmenityPlan;
  arrivalTime?: ArrivalTime;
  /** When the guest acknowledged the guest-registration notice. */
  registryAckAt?: string;
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
