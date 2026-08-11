import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin, getSupabaseAsUser } from "@/lib/server/supabaseAdmin";
import { refundTierFor } from "@/lib/reservations/cancellation";

/**
 * POST /api/cancel  { id: "NGM-XXXXXX" }
 * Cancels the caller's own reservation, refunding the tier the policy allows
 * (100% / 50% / 0% — see lib/reservations/cancellation.ts). Refund-bearing
 * cancellations only complete if the Stripe refund succeeds — money and
 * reservation state never diverge.
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

  const paid = Boolean(reservation.paid_at && reservation.stripe_session_id);
  const { refundPercent } = refundTierFor(reservation.check_in as string);
  const refundYen = paid ? Math.round(((reservation.total_yen as number) * refundPercent) / 100) : 0;

  if (refundYen > 0) {
    try {
      const stripe = new Stripe(stripeKey);
      const session = await stripe.checkout.sessions.retrieve(reservation.stripe_session_id as string);
      const paymentIntent =
        typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!paymentIntent) throw new Error("no payment intent on session");
      // JPY is zero-decimal: `amount` is in yen. Full tier still gets an
      // explicit amount so the charge and refund always reconcile.
      await stripe.refunds.create({ payment_intent: paymentIntent, amount: refundYen });
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
    return NextResponse.json({ error: "DB_ERROR", refundPercent, refundYen }, { status: 500 });
  }

  return NextResponse.json({ cancelled: true, refundPercent, refundYen });
}
