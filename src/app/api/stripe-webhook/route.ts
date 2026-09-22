import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { sendReservationConfirmation } from "@/lib/server/reservationEmail";
import { applyCancellationRefund } from "@/lib/server/cancellation";
import { reservationLanguage } from "@/lib/reservations/language";

/**
 * POST /api/stripe-webhook
 * Stripe → us. Confirms reservations on payment; frees held dates when a
 * checkout session expires unpaid. Configure the endpoint in the Stripe
 * dashboard (events: checkout.session.completed, checkout.session.expired,
 * checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
 * refund.created, refund.updated, refund.failed)
 * and put its signing secret in STRIPE_WEBHOOK_SECRET.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = getSupabaseAdmin();
  if (!stripeKey || !webhookSecret || !admin) {
    return NextResponse.json({ error: "not configured" }, { status: 501 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeKey);
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "refund.created" || event.type === "refund.updated" || event.type === "refund.failed") {
    const refundEvent = event.data.object as Stripe.Refund;
    if (!refundEvent.metadata?.cancellation_reservation_id) return NextResponse.json({ received: true });
    try {
      // Events can arrive out of order: always reconcile the latest Stripe state.
      const refund = await new Stripe(stripeKey).refunds.retrieve(refundEvent.id);
      const result = await applyCancellationRefund(admin, refund);
      if (result?.emailPending) return NextResponse.json({ error: "cancellation email failed" }, { status: 500 });
    } catch (error) {
      console.error("refund webhook failed:", refundEvent.id, error instanceof Error ? error.message : "unknown error");
      return NextResponse.json({ error: "refund reconciliation failed" }, { status: 500 });
    }
    return NextResponse.json({ received: true });
  }

  const paymentEvent = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
  const releaseEvent = event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed";
  if (paymentEvent || releaseEvent) {
    const session = event.data.object as Stripe.Checkout.Session;
    const reservationId = session.metadata?.reservation_id;
    if (reservationId) {
      if (paymentEvent) {
        // Completing Checkout does not necessarily mean payment has settled.
        if (session.mode !== "payment" || session.payment_status !== "paid") {
          return NextResponse.json({ received: true });
        }
        const { data: reservation, error: readError } = await admin.from("reservations")
          .select("id, name, email, check_in, check_out, guests, total_yen, status, stripe_session_id, lang")
          .eq("id", reservationId).single();
        if (readError || !reservation) return NextResponse.json({ error: "db error" }, { status: 500 });
        if (session.currency !== "jpy" || session.amount_total !== reservation.total_yen ||
          (reservation.stripe_session_id && reservation.stripe_session_id !== session.id)) {
          console.error("webhook payment mismatch:", reservationId);
          return NextResponse.json({ error: "payment mismatch" }, { status: 500 });
        }
        if (reservation.status === "cancelled") return NextResponse.json({ received: true });
        const { error } = await admin
          .from("reservations")
          .update({ status: "confirmed", paid_at: new Date().toISOString(), stripe_session_id: session.id,
            lang: reservationLanguage(reservation.lang, session.metadata?.lang, session.locale) })
          .eq("id", reservationId)
          .eq("status", "pending");
        if (error) {
          console.error("webhook confirm failed:", reservationId, error);
          // 500 → Stripe retries the delivery.
          return NextResponse.json({ error: "db error" }, { status: 500 });
        }
        // Re-read on every delivery, including retries after email failure.
        // A cancelled reservation must never be revived by a repeated event.
        const { data: confirmed, error: confirmReadError } = await admin.from("reservations")
          .select("id, name, email, check_in, check_out, guests, total_yen, lang")
          .eq("id", reservationId).eq("status", "confirmed")
          .eq("stripe_session_id", session.id).not("paid_at", "is", null).maybeSingle();
        if (confirmReadError) return NextResponse.json({ error: "db error" }, { status: 500 });
        if (confirmed) {
          try {
            await sendReservationConfirmation(admin, confirmed, reservationLanguage(confirmed.lang, session.metadata?.lang, session.locale));
          } catch (error) {
            console.error("confirmation email failed:", reservationId, error instanceof Error ? error.message : "unknown error");
            // Payment stays confirmed. Stripe retries this webhook, including the email.
            return NextResponse.json({ error: "confirmation email failed" }, { status: 500 });
          }
        }
      } else {
        // Expired unpaid → release the dates.
        const { error } = await admin
          .from("reservations")
          .update({ status: "cancelled" })
          .eq("id", reservationId)
          .eq("status", "pending");
        if (error) return NextResponse.json({ error: "db error" }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
