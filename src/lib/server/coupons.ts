import type Stripe from "stripe";

/**
 * Coupon codes are Stripe promotion codes, created by the owner in the Stripe
 * dashboard (percent off or a fixed JPY amount off; "limit to 1 redemption"
 * for single-use codes). Stripe applies the code at checkout and counts the
 * redemption when payment completes, so single-use limits are enforced there.
 *
 * This module only answers "is this code usable for this subtotal, and roughly
 * what will it take off?" — the amount actually charged always comes from the
 * Checkout Session Stripe creates.
 */

export type CouponQuote = {
  /** The code as stored in Stripe (canonical casing). */
  code: string;
  promotionCodeId: string;
  discountYen: number;
  totalYen: number;
};

/** Stripe's minimum charge in JPY. A code that would go below it (e.g. 100% off) is refused. */
const MIN_CHARGE_YEN = 50;

export function normalizeCouponCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return code && code.length <= 64 ? code : null;
}

export async function quoteCoupon(stripe: Stripe, code: string, subtotalYen: number): Promise<CouponQuote | null> {
  // Stripe matches `code` case-insensitively.
  const { data } = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 1,
    expand: ["data.promotion.coupon"],
  });
  const promo = data[0];
  if (!promo) return null;

  const now = Math.floor(Date.now() / 1000);
  if (promo.expires_at && promo.expires_at <= now) return null;
  if (promo.max_redemptions != null && promo.times_redeemed >= promo.max_redemptions) return null;
  // Codes tied to one Stripe customer can't be matched to a website guest.
  if (promo.customer) return null;

  const minimum = promo.restrictions.minimum_amount_currency === "jpy"
    ? promo.restrictions.minimum_amount
    : promo.restrictions.currency_options?.jpy?.minimum_amount ?? null;
  if (minimum != null && subtotalYen < minimum) return null;

  const coupon = promo.promotion.coupon;
  // `valid` covers the coupon's own expiry and redemption limit.
  if (!coupon || typeof coupon === "string" || !coupon.valid) return null;
  // Our line item is created per booking, so product-restricted coupons would never apply.
  if (coupon.applies_to?.products?.length) return null;

  let discountYen: number;
  if (coupon.percent_off != null) {
    discountYen = Math.round(subtotalYen * coupon.percent_off / 100);
  } else {
    const amountOff = coupon.currency === "jpy" ? coupon.amount_off : coupon.currency_options?.jpy?.amount_off ?? null;
    if (amountOff == null) return null;
    discountYen = Math.min(amountOff, subtotalYen);
  }

  const totalYen = subtotalYen - discountYen;
  if (discountYen <= 0 || totalYen < MIN_CHARGE_YEN) return null;
  return { code: promo.code, promotionCodeId: promo.id, discountYen, totalYen };
}
