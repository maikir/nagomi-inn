import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Pending holds keep dates off the market while a guest is in Stripe Checkout
 * (at most 30 minutes). Guardrails, so they can't be abused or get stuck:
 *  • only the server creates them (supabase/migrations/20260930230049_server_only_bookings.sql);
 *  • each guest has at most one open hold (releaseGuestHolds);
 *  • a hold that never got a Checkout session is released after an hour
 *    (releaseOrphanedHolds) — without a session it can never be paid.
 */

const ORPHAN_AFTER_MS = 60 * 60 * 1000;

/**
 * Release this guest's earlier holds before a new checkout (e.g. they backed
 * out of Stripe and are trying again). Returns false if one is mid-payment —
 * that hold is left alone and the new checkout should not proceed.
 */
export async function releaseGuestHolds(admin: SupabaseClient, stripe: Stripe, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("reservations")
    .select("id, stripe_session_id")
    .eq("user_id", userId)
    .eq("status", "pending");
  if (error) throw new Error("Could not read existing holds");

  let paymentInProgress = false;
  for (const hold of data ?? []) {
    if (hold.stripe_session_id) {
      const session = await stripe.checkout.sessions.retrieve(hold.stripe_session_id);
      // Complete = paid, or awaiting a delayed payment method: never release it.
      if (session.status === "complete") {
        paymentInProgress = true;
        continue;
      }
      // Expire first so the old Checkout page can no longer take a payment.
      if (session.status === "open") await stripe.checkout.sessions.expire(session.id);
    }
    const { error: releaseError } = await admin
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", hold.id)
      .eq("status", "pending");
    if (releaseError) throw new Error("Could not release previous hold");
  }
  return !paymentInProgress;
}

/** Release holds that never got a Checkout session (e.g. a crash mid-checkout). */
export async function releaseOrphanedHolds(admin: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - ORPHAN_AFTER_MS).toISOString();
  const { error } = await admin
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .is("stripe_session_id", null)
    .lt("created_at", cutoff);
  if (error) throw new Error("Could not release orphaned holds");
}
