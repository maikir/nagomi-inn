import { NextResponse } from "next/server";
import Stripe from "stripe";
import { nightsBetween } from "@/lib/reservations/dates";
import { getSupabaseAsUser } from "@/lib/server/supabaseAdmin";
import { getEffectivePricing } from "@/lib/server/pricing";
import { computeBreakdown } from "@/lib/pricing";
import { normalizeCouponCode, quoteCoupon } from "@/lib/server/coupons";

/**
 * POST /api/coupon
 * Checks a coupon code against the stay and returns the discount preview shown
 * on the confirm step. Signed-in guests only (the same gate as checkout), which
 * also keeps code-guessing off our Stripe API quota. Checkout re-checks the
 * code; Stripe decides the final amount.
 */

export const dynamic = "force-dynamic";

type Body = { code?: string; checkIn?: string; checkOut?: string; guests?: number };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED" }, { status: 501 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const supabase = getSupabaseAsUser(token);
  if (!supabase) return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED" }, { status: 501 });
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const code = normalizeCouponCode(body.code);
  const { checkIn, checkOut, guests } = body;
  const p = await getEffectivePricing();
  if (
    !code || !checkIn || !checkOut || !ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut) || checkOut <= checkIn ||
    !guests || !Number.isInteger(guests) || guests < p.minGuests || guests > p.maxGuests
  ) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < p.minNights || nights > p.maxNights) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const { total } = computeBreakdown(p, nights, guests);
  try {
    const quote = await quoteCoupon(new Stripe(stripeKey), code, total);
    if (!quote) return NextResponse.json({ error: "COUPON_INVALID" }, { status: 400 });
    return NextResponse.json({ code: quote.code, discountYen: quote.discountYen, totalYen: quote.totalYen });
  } catch (e) {
    console.error("coupon lookup error:", e);
    return NextResponse.json({ error: "COUPON_LOOKUP_FAILED" }, { status: 502 });
  }
}
