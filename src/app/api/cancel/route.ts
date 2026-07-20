import { NextResponse } from "next/server";
import Stripe from "stripe";
import { site } from "@/config/site";
import { getSupabaseAdmin, getSupabaseAsUser } from "@/lib/server/supabaseAdmin";

/**
 * POST /api/cancel  { id: "NGM-XXXXXX" }
 * Cancels the caller's own reservation and, when the stay was paid and the
 * cancellation policy allows it (site.cancellation), refunds the payment
 * through Stripe. Refund-eligible cancellations only complete if the refund
 * succeeds — money and reservation state never diverge.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!admin || !stripeKey) {
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED" }, { status: 501 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const supabase = getSupabaseAsUser(token);
  const user = supabase ? (await supabase.auth.getUser(token)).data.user : null;
  if (!supabase || !user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // RLS: this query only finds the reservation if it belongs to the caller.
  const { data: reservation } = await supabase.from("reservations").select("*").eq("id", id).maybeSingle();
  if (!reservation) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (reservation.status !== "confirmed") {
    return NextResponse.json({ error: "NOT_CANCELLABLE" }, { status: 400 });
  }

  const daysUntilCheckIn = Math.floor(
    (new Date(reservation.check_in + "T00:00:00Z").getTime() - Date.now()) / 86_400_000,
  );
  const refundable =
    Boolean(reservation.paid_at && reservation.stripe_session_id) &&
    daysUntilCheckIn >= site.cancellation.fullRefundUntilDaysBefore;

  if (refundable) {
    try {
      const stripe = new Stripe(stripeKey);
      const session = await stripe.checkout.sessions.retrieve(reservation.stripe_session_id as string);
      const paymentIntent =
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!paymentIntent) throw new Error("no payment intent on session");
      await stripe.refunds.create({ payment_intent: paymentIntent });
    } catch (e) {
      // Refund didn't go through → keep the reservation confirmed so the
      // guest can retry or contact the owner; nothing is silently lost.
      console.error("refund failed:", id, e);
      return NextResponse.json({ error: "REFUND_FAILED" }, { status: 502 });
    }
  }

  const { error: updateError } = await admin
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "confirmed");
  if (updateError) {
    console.error("cancel update failed after refund:", id, updateError);
    return NextResponse.json({ error: "DB_ERROR", refunded: refundable }, { status: 500 });
  }

  return NextResponse.json({ cancelled: true, refunded: refundable });
}
