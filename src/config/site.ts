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
  /** Tagline shown next to the 和 logo mark (nav/footer) — drops the kanji
   *  so it isn't repeated right beside the logo. */
  taglineLockup: "田舎民泊",
  url: "https://nagomi-inn.example.com", // replace with the production domain

  contact: {
    email: "info@nagomi-inn.jp", // PLACEHOLDER
    phone: "+81 70-6461-0434",
    instagram: "nagomi_inn_miyazaki",
  },

  location: {
    en: "Miyazaki Prefecture, Kyushu, Japan",
    ja: "宮崎県"
  },

  pricing: {
    currency: "JPY",
    /** 2〜8名 ¥80,000/1泊 — whole-property base rate per night. */
    baseNightly: 80_000,
    /** Guests included in the base rate. */
    includedGuests: 8,
    /** 9名以上 ¥5,000/人 per night. */
    perGuestNightly: 5_000,
    /** No separate cleaning fee — included in the nightly rate. */
    cleaningFee: 0,
    minGuests: 2,
    maxGuests: 18, // ¥80,000〜¥130,000/1泊
    minNights: 1,
    maxNights: 14,
  },

  checkIn: "15:00",
  checkOut: "10:00",

  /**
   * キャンセルポリシー
   *   チェックイン5日前まで無料
   *   4日前〜1日前　キャンセル料50%
   *   当日（チェックイン24時間以内＝前日15時以降）100%
   * Tier boundaries are computed in JST in src/lib/reservations/cancellation.ts
   * — that file is the single source of truth for the refund math.
   */
  cancellation: {
    /** Cancelling on/before this many days ahead of check-in → free. */
    freeUntilDaysBefore: 5,
    /** Inside the free boundary but before the same-day window → 50% fee. */
    lateFeePercent: 50,
    /** Within 24h of check-in (after 15:00 the day before) → 100% fee. */
    sameDayFeePercent: 100,
  },
} as const;

export function formatYen(amount: number): string {
  return "¥" + amount.toLocaleString("ja-JP");
}
