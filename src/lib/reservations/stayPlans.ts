/**
 * Stay plans the guest tells us at booking, so the hosts can prepare:
 * BBQ grill / barrel sauna use and an estimated arrival time. Fixed once
 * booked (guests contact the hosts to change them). Values mirror the DB
 * check constraints in supabase/stay-plans.sql.
 */

export const AMENITY_PLANS = ["yes", "no", "undecided"] as const;
export type AmenityPlan = (typeof AMENITY_PLANS)[number];

/** Hourly from check-in (15:00) to 21:00, then "late" and "undecided". */
export const ARRIVAL_TIMES = ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "late", "undecided"] as const;
export type ArrivalTime = (typeof ARRIVAL_TIMES)[number];

export function isAmenityPlan(value: unknown): value is AmenityPlan {
  return typeof value === "string" && (AMENITY_PLANS as readonly string[]).includes(value);
}

export function isArrivalTime(value: unknown): value is ArrivalTime {
  return typeof value === "string" && (ARRIVAL_TIMES as readonly string[]).includes(value);
}

type PlanLabels = { planYes: string; planNo: string; planUndecided: string; arrivalLate: string };

export function amenityPlanLabel(plan: AmenityPlan, t: PlanLabels): string {
  return plan === "yes" ? t.planYes : plan === "no" ? t.planNo : t.planUndecided;
}

export function arrivalTimeLabel(time: ArrivalTime, t: PlanLabels): string {
  return time === "late" ? t.arrivalLate : time === "undecided" ? t.planUndecided : time;
}
