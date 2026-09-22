import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refundTierFor } from "@/lib/reservations/cancellation";
import { sendCancellationConfirmation, type PaidReservation } from "./reservationEmail";

type ReservationRow = PaidReservation & { status: string; paid_at: string | null; stripe_session_id: string | null };
type Cancellation = {
  reservation_id: string;
  refund_yen: number;
  refund_percent: number;
  lang: "en" | "ja";
  payment_intent_id: string | null;
  stripe_refund_id: string | null;
  refund_status: string | null;
  first_attempt_at: string | null;
  completed_at: string | null;
  email_completed_at: string | null;
};
export type CancellationResult = {
  cancelled: boolean;
  pending?: boolean;
  refundFailed?: boolean;
  emailPending?: boolean;
  refundPercent: number;
  refundYen: number;
};

async function loadCancellation(admin: SupabaseClient, id: string): Promise<Cancellation | null> {
  const { data, error } = await admin.from("reservation_cancellations").select("*").eq("reservation_id", id).maybeSingle();
  if (error) throw new Error("Could not read cancellation");
  return data;
}

async function finishCancellation(admin: SupabaseClient, c: Cancellation): Promise<CancellationResult> {
  const { error } = await admin.rpc("complete_reservation_cancellation", { p_id: c.reservation_id });
  if (error) throw new Error("Could not complete cancellation after refund");
  const result: CancellationResult = { cancelled: true, refundPercent: c.refund_percent, refundYen: c.refund_yen };
  if (c.email_completed_at) return result;
  try {
    const { data: reservation, error: readError } = await admin.from("reservations")
      .select("id, name, email, check_in, check_out, guests, total_yen")
      .eq("id", c.reservation_id).eq("status", "cancelled").single();
    if (readError || !reservation) throw new Error("Could not read cancelled reservation");
    await sendCancellationConfirmation(admin, reservation, c.lang, c.refund_yen);
    // Disabled emails are deliberately skipped, rather than backfilled later.
    const { error: emailError } = await admin.from("reservation_cancellations")
      .update({ email_completed_at: new Date().toISOString() }).eq("reservation_id", c.reservation_id);
    if (emailError) throw new Error("Could not record cancellation notification");
  } catch (error) {
    console.error("cancellation email failed:", c.reservation_id, error instanceof Error ? error.message : "unknown error");
    result.emailPending = true;
  }
  return result;
}

/** Shared by the authenticated API and signed refund webhooks. */
export async function applyCancellationRefund(admin: SupabaseClient, refund: Stripe.Refund): Promise<CancellationResult | null> {
  const id = refund.metadata?.cancellation_reservation_id;
  if (!id) return null; // Dashboard refunds do not imply cancellation of a stay.
  const c = await loadCancellation(admin, id);
  if (!c) throw new Error("Cancellation missing for refund");
  const intent = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (refund.currency !== "jpy" || refund.amount !== c.refund_yen || intent !== c.payment_intent_id ||
    (c.stripe_refund_id && c.stripe_refund_id !== refund.id)) throw new Error("Cancellation refund mismatch");

  const { error: idError } = await admin.from("reservation_cancellations")
    .update({ stripe_refund_id: refund.id }).eq("reservation_id", id).is("stripe_refund_id", null);
  if (idError) throw new Error("Could not record refund ID");

  if (refund.status === "succeeded") {
    const { error } = await admin.from("reservation_cancellations")
      .update({ refund_status: "succeeded" }).eq("reservation_id", id);
    if (error) throw new Error("Could not record successful refund");
    return finishCancellation(admin, { ...c, refund_status: "succeeded" });
  }
  if (refund.status === "failed" || refund.status === "canceled") {
    // Even a previously successful refund can later fail at the bank. Flag it
    // for assistance, but never revive a cancelled booking or refund it again.
    const { error } = await admin.from("reservation_cancellations")
      .update({ refund_status: refund.status }).eq("reservation_id", id);
    if (error) throw new Error("Could not record failed refund");
    const { error: stateError } = await admin.from("reservations")
      .update({ cancellation_state: "failed" }).eq("id", id);
    if (stateError) throw new Error("Could not flag failed refund");
    console.error("cancellation refund requires owner assistance:", id, refund.id);
    return { cancelled: Boolean(c.completed_at), refundFailed: true, refundPercent: c.refund_percent, refundYen: c.refund_yen };
  }
  // Pending / requires_action is not success. Keep the dates reserved.
  return { cancelled: Boolean(c.completed_at), pending: !c.completed_at, refundPercent: c.refund_percent, refundYen: c.refund_yen };
}

export async function continueCancellation(admin: SupabaseClient, stripe: Stripe, c: Cancellation): Promise<CancellationResult> {
  if (c.refund_status === "failed" || c.refund_status === "canceled") {
    return { cancelled: Boolean(c.completed_at), refundFailed: true, refundPercent: c.refund_percent, refundYen: c.refund_yen };
  }
  if (c.completed_at || c.refund_yen === 0) return finishCancellation(admin, c);
  let refund: Stripe.Refund;
  if (c.stripe_refund_id) {
    refund = await stripe.refunds.retrieve(c.stripe_refund_id);
  } else {
    // Stripe's idempotency cache expires. Never risk a second partial refund
    // after an ambiguous request has aged out; an owner must reconcile it.
    if (c.first_attempt_at && Date.now() - Date.parse(c.first_attempt_at) >= 23 * 60 * 60 * 1000) {
      throw new Error("Refund needs owner review before retrying (idempotency window)");
    }
    const { error } = await admin.from("reservation_cancellations")
      .update({ first_attempt_at: new Date().toISOString() }).eq("reservation_id", c.reservation_id).is("first_attempt_at", null);
    if (error) throw new Error("Could not record refund attempt");
    refund = await stripe.refunds.create({
      payment_intent: c.payment_intent_id!, amount: c.refund_yen,
      metadata: { cancellation_reservation_id: c.reservation_id },
    }, { idempotencyKey: `reservation-cancellation/${c.reservation_id}` });
  }
  return (await applyCancellationRefund(admin, refund))!;
}

export async function requestCancellation(admin: SupabaseClient, stripe: Stripe, reservation: ReservationRow, lang: "en" | "ja") {
  let c = await loadCancellation(admin, reservation.id);
  if (!c) {
    if (reservation.status !== "confirmed" || !reservation.paid_at || !reservation.stripe_session_id) {
      throw new Error("Reservation is not a confirmed paid booking");
    }
    const { refundPercent } = refundTierFor(reservation.check_in);
    const refundYen = Math.round(reservation.total_yen * refundPercent / 100);
    const session = await stripe.checkout.sessions.retrieve(reservation.stripe_session_id);
    const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!intent || session.payment_status !== "paid" || session.currency !== "jpy" || session.amount_total !== reservation.total_yen ||
      session.metadata?.reservation_id !== reservation.id) throw new Error("Cancellation payment mismatch");
    const { error } = await admin.from("reservation_cancellations").upsert({
      reservation_id: reservation.id, refund_yen: refundYen, refund_percent: refundPercent,
      payment_intent_id: intent, lang,
    }, { onConflict: "reservation_id", ignoreDuplicates: true });
    if (error) throw new Error("Could not save cancellation request");
    c = await loadCancellation(admin, reservation.id);
    if (!c) throw new Error("Could not read saved cancellation request");
  }
  const { error } = await admin.from("reservations").update({ cancellation_state: "processing" })
    .eq("id", reservation.id).eq("status", "confirmed").is("cancellation_state", null);
  if (error) throw new Error("Could not mark cancellation processing");
  // The saved amount and language are immutable across repeated requests.
  return continueCancellation(admin, stripe, c);
}

/** A daily safety net, also callable manually, for no-refund email failures. */
export async function retryCancellations(admin: SupabaseClient, stripe: Stripe) {
  const { data, error } = await admin.from("reservation_cancellations").select("*")
    .is("email_completed_at", null).or("refund_status.is.null,refund_status.eq.succeeded")
    .order("created_at").limit(20);
  if (error) throw new Error("Could not load unfinished cancellations");
  let failed = 0;
  // Small batches keep independent retries within the serverless time budget.
  const rows = (data ?? []) as Cancellation[];
  for (let start = 0; start < rows.length; start += 5) {
    await Promise.all(rows.slice(start, start + 5).map(async c => {
      try {
        const result = await continueCancellation(admin, stripe, c);
        if (result.emailPending || result.refundFailed) failed++;
      } catch (error) {
        console.error("cancellation retry failed:", c.reservation_id, error instanceof Error ? error.message : "unknown error");
        failed++;
      }
    }));
  }
  return { checked: data?.length ?? 0, failed };
}
