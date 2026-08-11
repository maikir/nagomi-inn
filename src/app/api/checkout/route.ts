import { NextResponse } from "next/server";
import Stripe from "stripe";
import { site } from "@/config/site";
import { nightsBetween } from "@/lib/reservations/dates";
import { getSupabaseAdmin, getSupabaseAsUser } from "@/lib/server/supabaseAdmin";
import { syncExternalCalendars } from "@/lib/server/icalSync";

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
  const p = site.pricing;
  const today = new Date().toISOString().slice(0, 10);
  if (
    !checkIn || !checkOut || !ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut) ||
    checkOut <= checkIn || checkIn < today ||
    !guests || !Number.isInteger(guests) || guests < p.minGuests || guests > p.maxGuests ||
    !name?.trim() || !email?.trim()
  ) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < p.minNights || nights > p.maxNights) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // ── price: authoritative, server-side ─────────────────────────────────────
  const extraGuests = Math.max(0, guests - p.includedGuests);
  const total = nights * p.baseNightly + extraGuests * p.perGuestNightly * nights + p.cleaningFee;

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
      phone: body.phone?.trim() || null,
      notes: body.notes?.trim() || null,
      total_yen: total,
      status: "pending",
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
  const stripe = new Stripe(stripeKey);
  const origin = req.headers.get("origin") ?? site.url;
  const ja = body.lang === "ja";
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
      metadata: { reservation_id: reservation.id, user_id: user.id },
      // Unpaid sessions expire and the webhook frees the held dates.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${origin}/reserve/success?rid=${reservation.id}`,
      cancel_url: `${origin}/reserve?cancelled=1`,
      locale: ja ? "ja" : "en",
    });

    // Best-effort back-reference for support/refunds.
    await getSupabaseAdmin()
      ?.from("reservations")
      .update({ stripe_session_id: session.id })
      .eq("id", reservation.id);

    return NextResponse.json({ url: session.url });
  } catch (e) {
    // Stripe refused — release the hold so the dates aren't stuck.
    await getSupabaseAdmin()?.from("reservations").update({ status: "cancelled" }).eq("id", reservation.id);
    console.error("stripe checkout error:", e);
    return NextResponse.json({ error: "PAYMENT_ERROR" }, { status: 502 });
  }
}
