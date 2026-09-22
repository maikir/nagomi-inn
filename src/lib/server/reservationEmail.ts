import type { SupabaseClient } from "@supabase/supabase-js";
import { site, formatYen } from "@/config/site";
import { nightsBetween } from "@/lib/reservations/dates";

export type PaidReservation = {
  id: string;
  name: string;
  email: string;
  check_in: string;
  check_out: string;
  guests: number;
  total_yen: number;
};

type EmailConfig = { from: string; replyTo: string; address: string };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

export function confirmationEmail(reservation: PaidReservation, lang: "en" | "ja", config: EmailConfig) {
  const ja = lang === "ja";
  const title = ja ? "ご予約が確定しました" : "Your reservation is confirmed";
  const rows = [
    [ja ? "予約番号" : "Confirmation number", reservation.id],
    [ja ? "宿泊施設" : "Property", `${site.tagline} / ${site.fullName}`],
    [ja ? "住所" : "Address", config.address],
    [ja ? "チェックイン" : "Check-in", `${reservation.check_in} ${site.checkIn} (JST)`],
    [ja ? "チェックアウト" : "Check-out", `${reservation.check_out} ${site.checkOut} (JST)`],
    [ja ? "泊数" : "Nights", String(nightsBetween(reservation.check_in, reservation.check_out))],
    [ja ? "人数" : "Guests", String(reservation.guests)],
    [ja ? "お支払い済み金額" : "Amount paid", `${formatYen(reservation.total_yen)} JPY`],
    [ja ? "お問い合わせ" : "Contact", config.replyTo],
    [ja ? "電話" : "Phone", site.contact.phone],
  ];
  const greeting = ja ? `${reservation.name} 様` : `Hello ${reservation.name},`;
  const message = ja
    ? "お支払いを確認し、ご予約が確定しました。和でお迎えできることを楽しみにしております。"
    : "Your payment has been received and your stay is confirmed. We look forward to welcoming you to Nagomi.";
  const footer = ja ? "ご質問はこのメールにご返信ください。" : "Please reply to this email if you have any questions.";
  return {
    from: config.from,
    to: [reservation.email],
    reply_to: config.replyTo,
    subject: `${title} — NAGOMI ${reservation.id}`,
    text: [title, greeting, message, ...rows.map(([label, value]) => `${label}: ${value}`), footer].join("\n\n"),
    html: `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"></head><body style="margin:0;background:#f7f5f0;color:#292b25;font-family:Arial,sans-serif"><div style="max-width:600px;margin:24px auto;padding:28px;background:#ffffff"><p style="letter-spacing:3px">和 NAGOMI</p><h1 style="font-size:24px">${title}</h1><p>${escapeHtml(greeting)}</p><p style="line-height:1.7">${message}</p><table role="presentation" style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:12px 8px;border-bottom:1px solid #e6e5df;vertical-align:top">${label}</td><td style="padding:12px 8px;border-bottom:1px solid #e6e5df;white-space:pre-line">${escapeHtml(value)}</td></tr>`).join("")}</table><p style="line-height:1.7">${footer}</p></div></body></html>`,
  };
}

/** Called only after a signed Stripe event verifies payment and the DB confirms the stay. */
export async function sendReservationConfirmation(admin: SupabaseClient, reservation: PaidReservation, lang: "en" | "ja") {
  if (process.env.RESERVATION_EMAILS_ENABLED !== "true") return;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESERVATION_EMAIL_FROM;
  const replyTo = process.env.RESERVATION_EMAIL_REPLY_TO;
  const address = process.env.HOTEL_ADDRESS;
  if (!apiKey || !from || !replyTo || !address) throw new Error("Reservation email configuration is incomplete");

  // Freeze the payload: retries must use exactly the same content even after a deploy.
  const { error: insertError } = await admin.from("reservation_confirmation_emails").upsert({
    reservation_id: reservation.id,
    payload: confirmationEmail(reservation, lang, { from, replyTo, address }),
  }, { onConflict: "reservation_id", ignoreDuplicates: true });
  if (insertError) throw new Error("Could not queue confirmation email");
  const { data: email, error: readError } = await admin.from("reservation_confirmation_emails")
    .select("payload, sent_at, first_attempt_at").eq("reservation_id", reservation.id).single();
  if (readError || !email) throw new Error("Could not read confirmation email");
  if (email.sent_at) return;

  // Resend remembers keys for 24 hours. Beyond that, require operator review
  // rather than risk duplicating a send whose acknowledgement was lost.
  if (email.first_attempt_at && Date.now() - Date.parse(email.first_attempt_at) >= 23 * 60 * 60 * 1000) {
    throw new Error("Confirmation email needs review in Resend before retrying (idempotency window)");
  }
  const { error: attemptError } = await admin.from("reservation_confirmation_emails")
    .update({ first_attempt_at: new Date().toISOString() })
    .eq("reservation_id", reservation.id).is("first_attempt_at", null);
  if (attemptError) throw new Error("Could not record email attempt");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `reservation-confirmed/${reservation.id}` },
    body: JSON.stringify(email.payload),
    signal: AbortSignal.timeout(10_000),
  });
  // Do not log provider responses: they can contain guest details.
  if (!response.ok) throw new Error(`Resend confirmation request failed (${response.status})`);
  const result = await response.json() as { id?: string };
  if (!result.id) throw new Error("Resend did not return an email ID");
  const { error: saveError } = await admin.from("reservation_confirmation_emails")
    .update({ sent_at: new Date().toISOString(), resend_email_id: result.id })
    .eq("reservation_id", reservation.id);
  if (saveError) throw new Error("Could not record accepted confirmation email");
}
