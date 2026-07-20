import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

/**
 * POST /api/stripe-webhook
 * Stripe → us. Confirms reservations on payment; frees held dates when a
 * checkout session expires unpaid. Configure the endpoint in the Stripe
 * dashboard (events: checkout.session.completed, checkout.session.expired)
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

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const reservationId = session.metadata?.reservation_id;
    if (reservationId) {
      if (event.type === "checkout.session.completed") {
        const { error } = await admin
          .from("reservations")
          .update({ status: "confirmed", paid_at: new Date().toISOString(), stripe_session_id: session.id })
          .eq("id", reservationId)
          .eq("status", "pending");
        if (error) {
          console.error("webhook confirm failed:", reservationId, error);
          // 500 → Stripe retries the delivery.
          return NextResponse.json({ error: "db error" }, { status: 500 });
        }
      } else {
        // Expired unpaid → release the dates.
        await admin
          .from("reservations")
          .update({ status: "cancelled" })
          .eq("id", reservationId)
          .eq("status", "pending");
      }
    }
  }

  return NextResponse.json({ received: true });
}
