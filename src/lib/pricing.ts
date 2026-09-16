import { site } from "@/config/site";

/**
 * Pricing model. The four editable fields (base nightly rate, guests included
 * in that rate, per-extra-guest surcharge, cleaning fee) can be overridden by
 * the owner and stored in the DB (pricing_settings). The structural limits
 * (min/max guests & nights, currency) stay in site.ts. `defaultPricing` is the
 * fallback when the DB has no row or Supabase isn't configured.
 */

export type Pricing = {
  currency: string;
  baseNightly: number;
  includedGuests: number;
  perGuestNightly: number;
  cleaningFee: number;
  minGuests: number;
  maxGuests: number;
  minNights: number;
  maxNights: number;
};

/** The subset an owner can edit from the admin dashboard. */
export type EditablePricing = Pick<
  Pricing,
  "baseNightly" | "includedGuests" | "perGuestNightly" | "cleaningFee"
>;

export const defaultPricing: Pricing = { ...site.pricing };

/** Merge stored editable values over the defaults into a full Pricing object. */
export function mergePricing(overrides: Partial<EditablePricing> | null | undefined): Pricing {
  if (!overrides) return defaultPricing;
  return {
    ...defaultPricing,
    baseNightly: overrides.baseNightly ?? defaultPricing.baseNightly,
    includedGuests: overrides.includedGuests ?? defaultPricing.includedGuests,
    perGuestNightly: overrides.perGuestNightly ?? defaultPricing.perGuestNightly,
    cleaningFee: overrides.cleaningFee ?? defaultPricing.cleaningFee,
  };
}

export type PriceBreakdown = {
  extraGuests: number;
  baseTotal: number;
  extraTotal: number;
  cleaningFee: number;
  total: number;
};

/** Single source of truth for the stay total — used by the reserve page (display)
 *  and the checkout route (authoritative charge). */
export function computeBreakdown(pricing: Pricing, nights: number, guests: number): PriceBreakdown {
  if (nights <= 0) {
    return { extraGuests: 0, baseTotal: 0, extraTotal: 0, cleaningFee: 0, total: 0 };
  }
  const extraGuests = Math.max(0, guests - pricing.includedGuests);
  const baseTotal = nights * pricing.baseNightly;
  const extraTotal = extraGuests * pricing.perGuestNightly * nights;
  return {
    extraGuests,
    baseTotal,
    extraTotal,
    cleaningFee: pricing.cleaningFee,
    total: baseTotal + extraTotal + pricing.cleaningFee,
  };
}

/** Validate + normalize an incoming editable-pricing payload (from the admin form). */
export function sanitizeEditablePricing(input: unknown): EditablePricing | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : NaN);
  const baseNightly = int(o.baseNightly);
  const includedGuests = int(o.includedGuests);
  const perGuestNightly = int(o.perGuestNightly);
  const cleaningFee = int(o.cleaningFee);
  if ([baseNightly, includedGuests, perGuestNightly, cleaningFee].some(Number.isNaN)) return null;
  if (baseNightly < 0 || perGuestNightly < 0 || cleaningFee < 0) return null;
  if (includedGuests < site.pricing.minGuests || includedGuests > site.pricing.maxGuests) return null;
  return { baseNightly, includedGuests, perGuestNightly, cleaningFee };
}
