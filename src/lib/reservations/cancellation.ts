import { site } from "@/config/site";

/**
 * Cancellation policy — single source of truth for BOTH the warning shown to
 * the guest and the Stripe refund executed by /api/cancel.
 *
 *   チェックイン5日前まで無料                    → 100% refund
 *   4日前〜1日前　キャンセル料50%                →  50% refund
 *   当日（チェックイン24時間以内＝前日15時以降）100% →   0% refund
 *
 * All boundaries are computed in inn local time (JST, UTC+9), regardless of
 * the guest's or server's timezone:
 *   • check-in moment      = check-in date 15:00 JST
 *   • same-day window from = 15:00 JST the day before (24h before check-in)
 *   • 50% window from      = 00:00 JST four days before check-in
 */

export type RefundTier = {
  /** Percentage of the payment returned to the guest. */
  refundPercent: 100 | 50 | 0;
};

export function refundTierFor(checkIn: string, now: Date = new Date()): RefundTier {
  // JST offsets in the ISO strings make these absolute moments — safe to
  // compare against `now` from any timezone.
  const checkInMoment = new Date(`${checkIn}T${site.checkIn}:00+09:00`);
  const sameDayFrom = new Date(checkInMoment.getTime() - 24 * 3600 * 1000);
  const feeDays = site.cancellation.freeUntilDaysBefore - 1; // 4日前 00:00 JST
  const lateFrom = new Date(new Date(`${checkIn}T00:00:00+09:00`).getTime() - feeDays * 86_400_000);

  if (now.getTime() >= sameDayFrom.getTime()) return { refundPercent: 0 };
  if (now.getTime() >= lateFrom.getTime()) return { refundPercent: 50 };
  return { refundPercent: 100 };
}

/** Yen amount refunded for a given total under the current policy. */
export function refundAmountFor(totalYen: number, checkIn: string, now: Date = new Date()): number {
  const { refundPercent } = refundTierFor(checkIn, now);
  return Math.round((totalYen * refundPercent) / 100);
}
