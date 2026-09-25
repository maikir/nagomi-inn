import type { SupabaseClient } from "@supabase/supabase-js";
import { site, formatYen } from "@/config/site";
import { nightsBetween } from "@/lib/reservations/dates";
import type { AmenityPlan, ArrivalTime } from "@/lib/reservations/stayPlans";

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

// Dotenv removes wrapper quotes; hosting dashboards can store them literally.
function emailSetting(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return trimmed;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Classify errors without copying provider messages that may contain guest data. */
export async function resendFailure(response: Response): Promise<Error> {
  const details: unknown = await response.json().catch(() => null);
  const knownNames = new Set([
    "validation_error", "invalid_parameter", "missing_required_field", "missing_required_parameter",
    "missing_api_key", "restricted_api_key", "invalid_permission", "suspended_api_key",
    "invalid_idempotency_key", "invalid_idempotent_request", "concurrent_idempotent_requests",
    "daily_quota_exceeded", "monthly_quota_exceeded", "rate_limit_exceeded",
    "application_error", "service_unavailable",
  ]);
  const error = details && typeof details === "object" ? details as Record<string, unknown> : {};
  const name = typeof error.name === "string" && knownNames.has(error.name) ? error.name : "unknown_error";
  const message = typeof error.message === "string" ? error.message : "";
  const fields = ["from", "to", "reply_to", "subject", "html", "text"]
    .filter(field => new RegExp(`(?:\\x60|["'])${field}(?:\\x60|["'])`, "i").test(message));
  const hint = fields.includes("from")
    ? " Check RESERVATION_EMAIL_FROM formatting; Vercel values must not include dotenv wrapper quotes."
    : " Check the failed POST /emails response in Resend Logs for details.";
  return new Error(`Resend confirmation request failed (${response.status}, ${name}${fields.length ? `, fields: ${fields.join(", ")}` : ""}).${hint}`);
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

export function confirmationEmail(reservation: PaidReservation, lang: "en" | "ja", config: EmailConfig, cancellation?: { refundYen: number }) {
  const ja = lang === "ja";
  const title = cancellation
    ? (ja ? "ご予約をキャンセルしました" : "Your reservation has been cancelled")
    : (ja ? "ご予約が確定しました" : "Your reservation is confirmed");
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
  if (cancellation) rows.splice(8, 0,
    [ja ? "返金額" : "Refund amount", `${formatYen(cancellation.refundYen)} JPY`],
    [ja ? "キャンセル料" : "Cancellation fee", `${formatYen(reservation.total_yen - cancellation.refundYen)} JPY`],
  );
  const greeting = ja ? `${reservation.name} 様` : `Hello ${reservation.name},`;
  const message = cancellation ? (cancellation.refundYen > 0
    ? (ja ? "ご予約のキャンセルと返金処理が完了しました。返金は元のお支払い方法に戻ります。明細への反映時期は金融機関により異なります。" : "Your reservation is cancelled and the refund has been processed to your original payment method. The time it takes to appear on your statement depends on your bank.")
    : (ja ? "ご予約をキャンセルしました。キャンセルポリシーに基づき、返金はございません。" : "Your reservation is cancelled. No refund is due under the cancellation policy.")) : ja
    ? "お支払いを確認し、ご予約が確定しました。和でお迎えできることを楽しみにしております。チェックインのご案内など、私たち家族からのご挨拶メールをこの後お送りいたします。"
    : "Your payment has been received and your stay is confirmed. We look forward to welcoming you to Nagomi. A welcome note from our family, with check-in details, will follow shortly.";
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

export type WelcomeReservation = PaidReservation & {
  bbq_plan: AmenityPlan | null;
  sauna_plan: AmenityPlan | null;
  arrival_time: ArrivalTime | null;
};

type WelcomeSection = { heading: string; paragraphs: string[]; list?: string[] };

/**
 * The hosts' personal welcome note (the family's own letter), sent right after
 * the confirmation. Reflects what the guest told us at booking (arrival time,
 * BBQ / sauna plans) instead of asking again.
 */
export function welcomeEmail(reservation: WelcomeReservation, lang: "en" | "ja", config: EmailConfig) {
  const ja = lang === "ja";
  const nights = nightsBetween(reservation.check_in, reservation.check_out);
  const arrival = reservation.arrival_time;
  const arrivalLine = ja
    ? arrival === "late"
      ? "21時以降のご到着とお伺いしております。到着時刻が分かり次第、ご連絡いただけますと非常に助かります。"
      : arrival && arrival !== "undecided"
        ? `${arrival}頃のご到着とお伺いしております。ご変更がございましたら、当日でも構いませんのでご連絡ください。`
        : "当日、宿への到着時刻が分かり次第ご連絡いただけますと非常に助かります。"
    : arrival === "late"
      ? "You mentioned you'll arrive after 21:00. Once you know your arrival time, please let us know — it helps us a great deal."
      : arrival && arrival !== "undecided"
        ? `You mentioned you expect to arrive around ${arrival}. If that changes — even on the day — please let us know.`
        : "Once you know your arrival time on the day, please let us know — it helps us a great deal.";

  // NULL (legacy rows) reads as "not decided yet".
  const amenity = (plan: AmenityPlan | null, jaName: string, enName: string) =>
    plan === "yes"
      ? ja ? `${jaName}：ご利用予定と承りました。事前にご準備いたします。` : `${enName}: you plan to use it — we'll have it ready for you.`
      : plan === "no"
        ? ja ? `${jaName}：今回はご利用なしと承りました。` : `${enName}: not planned this time.`
        : ja ? `${jaName}：ご利用がお決まりになりましたら、事前にご準備いたしますのでご連絡ください。` : `${enName}: if you decide to use it, just let us know and we'll prepare it in advance.`;

  const amenityNotes = [
    ...(reservation.bbq_plan !== "no"
      ? [ja ? "BBQの炭と食材は、お客様ご自身でのご準備をお願いしております。" : "For the BBQ, please bring your own charcoal and ingredients."]
      : []),
    ja ? "ご予定が変わりましたら、お気軽にご連絡ください。" : "If your plans change, just let us know.",
  ];

  const title = ja ? "ようこそ、和へ" : "Welcome to Nagomi";
  const greeting = ja ? `${reservation.name} 様` : `Hello ${reservation.name},`;
  const summary = ja
    ? `ご予約番号 ${reservation.id}｜${reservation.check_in} 〜 ${reservation.check_out}（${nights}泊・${reservation.guests}名）`
    : `Booking ${reservation.id} · ${reservation.check_in} → ${reservation.check_out} (${nights} night${nights === 1 ? "" : "s"}, ${reservation.guests} guests)`;
  const intro = ja
    ? [
        "初めまして、私たちの宿を選んでいただきありがとうございます。田舎民泊「和」Nagomi Inn Miyazakiは私たち家族で営んでおりまして、管理人として私の両親が現地へ駐在しています。",
        "サービスで至らぬところがあるかもしれませんが、快適にご滞在頂けるように精一杯ご対応させて頂きますので、よろしくお願い致します。",
        "当日お越し頂くのを楽しみにお待ちしておりますので、お気をつけてお越しくださいませ。",
      ]
    : [
        "Thank you so much for choosing to stay with us. Nagomi Inn Miyazaki is run by our family, and my parents live on site as the inn's managers.",
        "We may not get everything perfect, but we'll do our very best to make your stay a comfortable one.",
        "We're looking forward to welcoming you — please travel safely.",
      ];
  const sections: WelcomeSection[] = ja
    ? [
        { heading: "チェックインについて", paragraphs: [
          "当日のチェックインは、施設内の受付にて行います。受付は宿ののれんが掛かっている門をくぐって右手にございます。",
          arrivalLine,
          `住所：${config.address}`,
        ] },
        { heading: "宿泊者名簿について（旅館業法）", paragraphs: [
          "旅館業法にて、宿泊者様の①氏名、②住所、③連絡先をお伺いする決まりとなっておりますので、チェックイン時に確認させて頂きます。お連れ様に外国籍の方(日本在住で住民票登録されている場合は在留カードを確認させていただきます)がいらっしゃいましたら、国籍とパスポート番号も確認させて頂きますので、ご準備とご協力のほどよろしくお願い致します。",
        ] },
        { heading: "BBQグリル・バレルサウナについて", paragraphs: amenityNotes, list: [
          amenity(reservation.bbq_plan, "BBQグリル", "BBQ grill"),
          amenity(reservation.sauna_plan, "バレルサウナ", "Barrel sauna"),
        ] },
        { heading: "お持ち物について", paragraphs: [
          "歯ブラシは宿に備え付けがございませんので、ご持参いただきますようお願いいたします。お忘れの場合は、受付にて販売もしております。",
        ] },
      ]
    : [
        { heading: "Checking in", paragraphs: [
          "Check-in is at the reception on the property. Walk through the gate hung with our noren curtain, and you'll find reception on your right.",
          arrivalLine,
          `Address: ${config.address}`,
        ] },
        { heading: "Guest registration (Hotel Business Act)", paragraphs: [
          "Under Japan's Hotel Business Act, we are required to record each guest's ① name, ② address and ③ contact details, which we'll confirm at check-in. If anyone in your party is a foreign national, we'll also need to check their nationality and passport number (for foreign residents registered in Japan, we'll check their residence card instead). Thank you for having these ready.",
        ] },
        { heading: "BBQ grill & barrel sauna", paragraphs: amenityNotes, list: [
          amenity(reservation.bbq_plan, "BBQグリル", "BBQ grill"),
          amenity(reservation.sauna_plan, "バレルサウナ", "Barrel sauna"),
        ] },
        { heading: "What to bring", paragraphs: [
          "Toothbrushes aren't provided at the inn, so please bring your own. If you forget, they're also available to buy at reception.",
        ] },
      ];
  const closing = ja
    ? `その他、ご不明な点やおすすめ情報など、ご質問がございましたら、このメールへのご返信またはお電話（${site.contact.phone}）でお気軽にご連絡ください。`
    : `If you have any other questions, or would like local recommendations, just reply to this email or give us a call (${site.contact.phone}).`;
  const signoff = ja ? ["田舎民泊「和」", "Nagomi Inn Miyazaki"] : ["Warm regards,", "Gen & Sarah from Nagomi Inn Miyazaki (田舎民泊「和」)"];

  const p = (text: string) => `<p style="line-height:1.8;margin:0 0 14px">${escapeHtml(text)}</p>`;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"></head><body style="margin:0;background:#f7f5f0;color:#292b25;font-family:Arial,sans-serif"><div style="max-width:600px;margin:24px auto;padding:28px;background:#ffffff">`
    + `<p style="letter-spacing:3px">和 NAGOMI</p><h1 style="font-size:24px">${title}</h1>`
    + `<p style="margin:0 0 6px">${escapeHtml(greeting)}</p><p style="margin:0 0 22px;font-size:13px;color:#7a776c">${escapeHtml(summary)}</p>`
    + intro.map(p).join("")
    + sections.map((s) => `<h2 style="font-size:16px;margin:28px 0 10px;padding-top:16px;border-top:1px solid #e6e5df">${escapeHtml(s.heading)}</h2>`
      + (s.list ? `<ul style="margin:0 0 14px;padding-left:20px;line-height:1.8">${s.list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "")
      + s.paragraphs.map(p).join("")).join("")
    + `<div style="margin-top:28px;padding-top:16px;border-top:1px solid #e6e5df">${p(closing)}<p style="line-height:1.8;margin:0">${signoff.map(escapeHtml).join("<br>")}</p></div>`
    + `</div></body></html>`;
  const text = [
    title, greeting, summary, ...intro,
    ...sections.map((s) => [`■ ${s.heading}`, ...(s.list ?? []).map((item) => `・${item}`), ...s.paragraphs].join("\n")),
    closing, signoff.join("\n"),
  ].join("\n\n");

  return {
    from: config.from,
    to: [reservation.email],
    reply_to: config.replyTo,
    subject: ja ? `ようこそ「和」へ — ご到着前のご案内（${reservation.id}）` : `Welcome to Nagomi — a note before your stay (${reservation.id})`,
    text,
    html,
  };
}

type EmailKind = "confirmation" | "cancellation" | "welcome";

// Tables and idempotency-key prefixes are part of the retry contract: keep them stable.
const OUTBOX: Record<EmailKind, { table: string; event: string }> = {
  confirmation: { table: "reservation_confirmation_emails", event: "reservation-confirmed" },
  cancellation: { table: "reservation_cancellation_emails", event: "reservation-cancelled" },
  welcome: { table: "reservation_welcome_emails", event: "reservation-welcome" },
};

/** Called only after a signed Stripe event verifies payment and the DB confirms the stay. */
export async function sendReservationConfirmation(admin: SupabaseClient, reservation: PaidReservation, lang: "en" | "ja") {
  return deliverReservationEmail(admin, "confirmation", reservation.id, (config) => confirmationEmail(reservation, lang, config));
}

export async function sendCancellationConfirmation(admin: SupabaseClient, reservation: PaidReservation, lang: "en" | "ja", refundYen: number) {
  return deliverReservationEmail(admin, "cancellation", reservation.id, (config) => confirmationEmail(reservation, lang, config, { refundYen }));
}

/** The hosts' welcome note; sent after the confirmation email for the same stay. */
export async function sendWelcomeEmail(admin: SupabaseClient, reservation: WelcomeReservation, lang: "en" | "ja") {
  return deliverReservationEmail(admin, "welcome", reservation.id, (config) => welcomeEmail(reservation, lang, config));
}

async function deliverReservationEmail(
  admin: SupabaseClient,
  kind: EmailKind,
  reservationId: string,
  buildPayload: (config: EmailConfig) => Record<string, unknown>,
) {
  if (process.env.RESERVATION_EMAILS_ENABLED !== "true") return;
  const apiKey = emailSetting(process.env.RESEND_API_KEY);
  // The welcome note may come from a personal sender name; defaults to the booking sender.
  const from = (kind === "welcome" && emailSetting(process.env.WELCOME_EMAIL_FROM)) || emailSetting(process.env.RESERVATION_EMAIL_FROM);
  const replyTo = emailSetting(process.env.RESERVATION_EMAIL_REPLY_TO);
  const address = emailSetting(process.env.HOTEL_ADDRESS);
  if (!apiKey || !from || !replyTo || !address) throw new Error("Reservation email configuration is incomplete");
  const { table, event } = OUTBOX[kind];

  // Freeze the payload: retries must use exactly the same content even after a deploy.
  const { error: insertError } = await admin.from(table).upsert({
    reservation_id: reservationId,
    payload: buildPayload({ from, replyTo, address }),
  }, { onConflict: "reservation_id", ignoreDuplicates: true });
  if (insertError) throw new Error(`Could not queue ${kind} email`);
  const { data: email, error: readError } = await admin.from(table)
    .select("payload, sent_at, first_attempt_at").eq("reservation_id", reservationId).single();
  if (readError || !email) throw new Error(`Could not read ${kind} email`);
  if (email.sent_at) return;

  // Resend remembers keys for 24 hours. Beyond that, require operator review
  // rather than risk duplicating a send whose acknowledgement was lost.
  if (email.first_attempt_at && Date.now() - Date.parse(email.first_attempt_at) >= 23 * 60 * 60 * 1000) {
    throw new Error(`${kind} email needs review in Resend before retrying (idempotency window)`);
  }
  const { error: attemptError } = await admin.from(table)
    .update({ first_attempt_at: new Date().toISOString() })
    .eq("reservation_id", reservationId).is("first_attempt_at", null);
  if (attemptError) throw new Error("Could not record email attempt");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `${event}/${reservationId}` },
    body: JSON.stringify(email.payload),
    signal: AbortSignal.timeout(10_000),
  });
  // Do not log provider responses: they can contain guest details.
  if (!response.ok) throw await resendFailure(response);
  const result = await response.json() as { id?: string };
  if (!result.id) throw new Error("Resend did not return an email ID");
  const { error: saveError } = await admin.from(table)
    .update({ sent_at: new Date().toISOString(), resend_email_id: result.id })
    .eq("reservation_id", reservationId);
  if (saveError) throw new Error(`Could not record accepted ${kind} email`);
}
