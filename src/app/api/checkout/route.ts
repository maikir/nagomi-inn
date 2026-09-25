import { NextResponse } from "next/server";
import Stripe from "stripe";
import { site } from "@/config/site";
import { nightsBetween } from "@/lib/reservations/dates";
import { getSupabaseAdmin, getSupabaseAsUser } from "@/lib/server/supabaseAdmin";
import { syncExternalCalendars } from "@/lib/server/icalSync";
import { getEffectivePricing } from "@/lib/server/pricing";
import { computeBreakdown } from "@/lib/pricing";
import { reservationLanguage } from "@/lib/reservations/language";
import { validGuestName, validGuestEmail, validGuestPhone, normalizeGuestPhone } from "@/lib/reservations/validation";
import { isAmenityPlan, isArrivalTime } from "@/lib/reservations/stayPlans";
import { normalizeCouponCode, quoteCoupon, type CouponQuote } from "@/lib/server/coupons";

/**
 * POST /api/checkout
 * Creates a 'pending' reservation (holding the dates) and a Stripe Checkout
 * session for it. The price is computed HERE, server-side — the client's
 * total is display-only. The webhook confirms the reservation on payment.
 */

export const dynamic = "force-dynamic";

type Body = {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  name?: string;
  email?: string;
  phone?: string;
  notes?: string;
  lang?: "en" | "ja";
  bbqPlan?: string;
  saunaPlan?: string;
  arrivalTime?: string;
  /** Guest ticked the Hotel Business Act guest-registration notice. */
  registryAck?: boolean;
  /** Optional Stripe promotion code, already previewed via /api/coupon. */
  couponCode?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED" }, { status: 501 });
  }

  // ── auth ──────────────────────────────────────────────────────────────────
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const supabase = getSupabaseAsUser(token);
  if (!supabase) return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED" }, { status: 501 });
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  // ── validate ──────────────────────────────────────────────────────────────
  const body = (await req.json().catch(() => ({}))) as Body;
  const { checkIn, checkOut, guests, name, email } = body;
  const lang = reservationLanguage(body.lang);
  // Pricing comes from the DB (owner-editable), not the client — authoritative.
  const p = await getEffectivePricing();
  const today = new Date().toISOString().slice(0, 10);
  if (
    !checkIn || !checkOut || !ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut) ||
    checkOut <= checkIn || checkIn < today ||
    !guests || !Number.isInteger(guests) || guests < p.minGuests || guests > p.maxGuests ||
    !validGuestName(name) || !validGuestEmail(email) || !validGuestPhone(body.phone) ||
    !isAmenityPlan(body.bbqPlan) || !isAmenityPlan(body.saunaPlan) || !isArrivalTime(body.arrivalTime) ||
    body.registryAck !== true
  ) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < p.minNights || nights > p.maxNights) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // ── price: authoritative, server-side ─────────────────────────────────────
  const { total } = computeBreakdown(p, nights, guests);
  const stripe = new Stripe(stripeKey);

  // ── coupon: re-checked here; Stripe applies it and decides the final amount ──
  let quote: CouponQuote | null = null;
  if (body.couponCode !== undefined && body.couponCode !== "") {
    const code = normalizeCouponCode(body.couponCode);
    // Recording the discounted total needs the service role (see below).
    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED" }, { status: 501 });
    try {
      quote = code ? await quoteCoupon(stripe, code, total) : null;
    } catch (e) {
      console.error("coupon lookup error:", e);
      return NextResponse.json({ error: "PAYMENT_ERROR" }, { status: 502 });
    }
    if (!quote) return NextResponse.json({ error: "COUPON_INVALID" }, { status: 400 });
  }

  // ── freshen OTA calendars if stale, then hold the dates ───────────────────
  try {
    await syncExternalCalendars({ ifStaleMinutes: 15 });
  } catch {
    // OTA feed hiccups must not block direct bookings; DB constraints still guard.
  }

  const { data: reservation, error: insertError } = await supabase
    .from("reservations")
    .insert({
      check_in: checkIn,
      check_out: checkOut,
      guests,
      name: name.trim(),
      email: email.trim(),
      phone: body.phone ? normalizeGuestPhone(body.phone) || null : null,
      notes: body.notes?.trim() || null,
      total_yen: total,
      status: "pending",
      lang,
      bbq_plan: body.bbqPlan,
      sauna_plan: body.saunaPlan,
      arrival_time: body.arrivalTime,
      // Server time, not the browser's: this is the record of acknowledgment.
      registry_ack_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (insertError) {
    const code = (insertError as { code?: string }).code;
    if (code === "23P01") return NextResponse.json({ error: "UNAVAILABLE" }, { status: 409 });
    if (code === "42501") return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  // ── Stripe Checkout session ───────────────────────────────────────────────
  const origin = req.headers.get("origin") ?? site.url;
  const ja = lang === "ja";
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email.trim(),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: total, // JPY is zero-decimal: amount is in yen
            product_data: {
              name: ja
                ? `${site.tagline} — ${checkIn} 〜 ${checkOut}`
                : `${site.fullName} — ${checkIn} to ${checkOut}`,
              description: ja
                ? `${nights}泊・${guests}名・一棟貸切`
                : `${nights} night(s) · ${guests} guests · whole property`,
            },
          },
        },
      ],
      ...(quote && { discounts: [{ promotion_code: quote.promotionCodeId }] }),
      metadata: { reservation_id: reservation.id, user_id: user.id, lang },
      // Unpaid sessions expire and the webhook frees the held dates.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${origin}/reserve/success?rid=${reservation.id}`,
      cancel_url: `${origin}/reserve?cancelled=1`,
      locale: ja ? "ja" : "en",
    });

    if (quote) {
      // The webhook and refunds only accept a charge equal to total_yen, so the
      // amount Stripe will actually charge must be recorded before the guest can
      // pay. If that fails, kill the session rather than take an unconfirmable payment.
      const amountTotal = session.amount_total;
      const { error: totalError } = amountTotal == null
        ? { error: new Error("Stripe returned no amount_total") }
        : await getSupabaseAdmin()!
          .from("reservations")
          .update({
            stripe_session_id: session.id,
            total_yen: amountTotal,
            coupon_code: quote.code,
            discount_yen: total - amountTotal,
          })
          .eq("id", reservation.id);
      if (totalError) {
        await stripe.checkout.sessions.expire(session.id).catch(() => {});
        throw totalError;
      }
    } else {
      // Best-effort back-reference for support/refunds.
      await getSupabaseAdmin()
        ?.from("reservations")
        .update({ stripe_session_id: session.id })
        .eq("id", reservation.id);
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    // Stripe refused — release the hold so the dates aren't stuck.
    await getSupabaseAdmin()?.from("reservations").update({ status: "cancelled" }).eq("id", reservation.id);
    console.error("stripe checkout error:", e);
    // e.g. the single-use code was just redeemed by someone else.
    if (quote && e instanceof Stripe.errors.StripeInvalidRequestError) {
      return NextResponse.json({ error: "COUPON_INVALID" }, { status: 400 });
    }
    return NextResponse.json({ error: "PAYMENT_ERROR" }, { status: 502 });
  }
}
