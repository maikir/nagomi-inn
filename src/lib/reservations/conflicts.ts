import { nightsOf } from "./dates";

/**
 * Double-booking detection for the owner dashboard.
 *
 * The whole property is a single unit, so any night held by two or more
 * distinct occupancies is a conflict. Direct-vs-direct can't happen (the DB
 * exclusion constraint prevents overlapping reservations), so real conflicts
 * are website-booking-vs-OTA-block, or OTA-vs-OTA (booked on Airbnb AND
 * Booking.com). Cancelled reservations are ignored.
 */

type Res = { id: string; checkIn: string; checkOut: string; status: string };
type Ext = { checkIn: string; checkOut: string };

export type Conflicts = {
  /** Nights (YYYY-MM-DD) held by 2+ occupancies — for the calendar. */
  nights: Set<string>;
  /** Reservation ids that overlap another occupancy — for the list. */
  reservationIds: Set<string>;
  /** Total distinct conflicting nights (for the summary count). */
  count: number;
};

export function findConflicts(reservations: Res[], externalBlocks: Ext[]): Conflicts {
  // night → set of unique occupancy tokens holding it
  const perNight = new Map<string, Set<string>>();
  const add = (night: string, token: string) => {
    const s = perNight.get(night) ?? new Set<string>();
    s.add(token);
    perNight.set(night, s);
  };

  for (const r of reservations) {
    if (r.status !== "confirmed" && r.status !== "pending") continue;
    for (const night of nightsOf(r.checkIn, r.checkOut)) add(night, `res:${r.id}`);
  }
  externalBlocks.forEach((b, i) => {
    // Each block is its own occupancy (index keeps two same-source blocks distinct).
    for (const night of nightsOf(b.checkIn, b.checkOut)) add(night, `ext:${i}`);
  });

  const nights = new Set<string>();
  const reservationIds = new Set<string>();
  perNight.forEach((tokens, night) => {
    if (tokens.size < 2) return;
    nights.add(night);
    tokens.forEach((tok) => {
      if (tok.startsWith("res:")) reservationIds.add(tok.slice(4));
    });
  });

  return { nights, reservationIds, count: nights.size };
}
