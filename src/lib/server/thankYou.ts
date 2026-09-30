import type { SupabaseClient } from "@supabase/supabase-js";
import { site } from "@/config/site";
import { reservationLanguage } from "@/lib/reservations/language";
import { sendThankYouEmail } from "./reservationEmail";

/**
 * Post-stay thank-you emails, run once a day by the daily job (13:00 JST).
 * Picks confirmed stays that checked out within the last few days, so a failed
 * send gets retried on the following runs; the email outbox guarantees each
 * guest is thanked at most once. Cancelled stays (or ones mid-cancellation)
 * are skipped, and OTA bookings never reach here — we don't have their email.
 */

const LOOKBACK_DAYS = 3;
const DAY_MS = 86_400_000;
const JST_MS = 9 * 3600 * 1000;

export async function sendDueThankYous(admin: SupabaseClient, now: Date = new Date()) {
  const jstNow = new Date(now.getTime() + JST_MS);
  const today = jstNow.toISOString().slice(0, 10);
  // Only include today's departures once check-out time has passed (in case the
  // job is triggered manually in the morning).
  const checkoutHour = Number(site.checkOut.slice(0, 2));
  const latest = jstNow.getUTCHours() > checkoutHour ? today : new Date(jstNow.getTime() - DAY_MS).toISOString().slice(0, 10);
  const earliest = new Date(jstNow.getTime() - LOOKBACK_DAYS * DAY_MS).toISOString().slice(0, 10);

  const { data: stays, error } = await admin
    .from("reservations")
    .select("id, name, email, check_in, check_out, guests, total_yen, lang")
    .eq("status", "confirmed")
    .is("cancellation_state", null)
    .gte("check_out", earliest)
    .lte("check_out", latest);
  if (error) throw new Error("Could not load finished stays");
  if (!stays?.length) return { due: 0, sent: 0, failed: 0 };

  const { data: done, error: doneError } = await admin
    .from("reservation_thankyou_emails")
    .select("reservation_id")
    .in("reservation_id", stays.map((s) => s.id))
    .not("sent_at", "is", null);
  if (doneError) throw new Error("Could not load sent thank-you emails");
  const alreadySent = new Set((done ?? []).map((d) => d.reservation_id as string));
  const due = stays.filter((s) => !alreadySent.has(s.id));

  let sent = 0;
  let failed = 0;
  for (const stay of due) {
    try {
      await sendThankYouEmail(admin, stay, reservationLanguage(stay.lang));
      sent++;
    } catch (e) {
      console.error("thank-you email failed:", stay.id, e instanceof Error ? e.message : "unknown error");
      failed++;
    }
  }
  return { due: due.length, sent, failed };
}
