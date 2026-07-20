/**
 * ─── SITE CONFIG ─────────────────────────────────────────────────────────────
 * Everything an owner is likely to want to change lives in this file:
 * contact details, pricing, capacity, check-in times.
 *
 * ⚠ CONTACT DETAILS BELOW ARE PLACEHOLDERS — replace with the real ones.
 */

export const site = {
  name: "NAGOMI",
  kanji: "和",
  fullName: "Nagomi Inn Miyazaki",
  tagline: "田舎民泊 和",
  url: "https://nagomi-inn.example.com", // replace with the production domain

  contact: {
    email: "info@nagomi-inn.jp", // PLACEHOLDER
    phone: "+81 90-0000-0000", // PLACEHOLDER
    instagram: "nagomi_inn_miyazaki", // PLACEHOLDER (handle only, no @)
  },

  location: {
    en: "Miyazaki Prefecture, Kyushu, Japan",
    ja: "宮崎県",
    airportNoteEn: "Nearest airport: Kagoshima (KOJ)",
    airportNoteJa: "最寄り空港：鹿児島空港（KOJ）",
  },

  pricing: {
    currency: "JPY",
    /** Whole-property base rate per night (both houses). PLACEHOLDER value. */
    baseNightly: 66_000,
    /** Guests included in the base rate. */
    includedGuests: 6,
    /** Per additional guest, per night. PLACEHOLDER value. */
    perGuestNightly: 4_400,
    /** One-time cleaning fee per stay. PLACEHOLDER value. */
    cleaningFee: 16_500,
    maxGuests: 16,
    minNights: 1,
    maxNights: 14,
  },

  checkIn: "15:00",
  checkOut: "10:00",

  cancellation: {
    /**
     * Cancelling at least this many days before check-in → full refund.
     * Closer than that → no refund (dates are still released).
     * PLACEHOLDER policy — set this to the house rules you actually want.
     */
    fullRefundUntilDaysBefore: 7,
  },
} as const;

export function formatYen(amount: number): string {
  return "¥" + amount.toLocaleString("ja-JP");
}
