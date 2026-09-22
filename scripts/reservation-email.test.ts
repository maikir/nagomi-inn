import { afterAll, afterEach, beforeEach, expect, mock, setSystemTime, test } from "bun:test";
import Stripe from "stripe";
import { confirmationEmail, resendFailure } from "../src/lib/server/reservationEmail";
import { requestCancellation, applyCancellationRefund, retryCancellations } from "../src/lib/server/cancellation";
import type { SupabaseClient } from "@supabase/supabase-js";

// In-memory DB and HTTP transport: no real bookings, payments, or emails.
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let failSentUpdate = false;
const admin = {
  async rpc(_name: string, { p_id }: { p_id: string }) {
    const c = tables.reservation_cancellations.find(row => row.reservation_id === p_id)!;
    if (Number(c.refund_yen) > 0 && c.refund_status !== "succeeded") return { error: new Error("refund not succeeded") };
    const row = tables.reservations.find(row => row.id === p_id)!;
    Object.assign(row, { status: "cancelled", cancellation_state: "completed" });
    c.completed_at ??= new Date().toISOString();
    return { error: null };
  },
  from(table: string) {
    let action = "select";
    let values: Row = {};
    let list = false;
    const filters: ((row: Row) => boolean)[] = [];
    const query = {
      select() { return query; },
      update(input: Row) { action = "update"; values = input; return query; },
      upsert(input: Row) { action = "upsert"; values = input; return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      is(key: string, value: unknown) { return query.eq(key, value); },
      not(key: string) { filters.push(row => row[key] != null); return query; },
      order() { return query; },
      limit() { list = true; return query; },
      or() { filters.push(row => row.refund_status == null || row.refund_status === "succeeded"); return query; },
      single() { return query; },
      maybeSingle() { return query; },
      then(resolve: (value: { data: Row | Row[] | null; error: unknown }) => unknown) {
        if (action === "upsert" && !tables[table].some(row => row.reservation_id === values.reservation_id)) {
          tables[table].push({ first_attempt_at: null, sent_at: null, stripe_refund_id: null, refund_status: null, completed_at: null, email_completed_at: null, ...values });
        }
        const rows = tables[table].filter(row => filters.every(filter => filter(row)));
        if (action === "update" && values.sent_at && failSentUpdate) {
          return Promise.resolve(resolve({ data: null, error: new Error("simulated DB failure") }));
        }
        if (action === "update") rows.forEach(row => Object.assign(row, values));
        return Promise.resolve(resolve({ data: list ? rows.map(row => ({ ...row })) : rows[0] ? { ...rows[0] } : null, error: null }));
      },
    };
    return query;
  },
};
mock.module("../src/lib/server/supabaseAdmin", () => ({ getSupabaseAdmin: () => admin }));
const { POST } = await import("../src/app/api/stripe-webhook/route");

test("Resend errors identify invalid sender without logging private response content", async () => {
  const error = await resendFailure(Response.json({ name: "invalid_parameter", message: 'Invalid `from` field: private@example.com' }, { status: 422 }));
  expect(error.message).toContain("422, invalid_parameter, fields: from");
  expect(error.message).toContain("dotenv wrapper quotes");
  expect(error.message).not.toContain("private@example.com");
});
test("unexpected provider errors cannot leak arbitrary response fields", async () => {
  const error = await resendFailure(Response.json({ name: "private@example.com", message: "Guest details" }, { status: 422 }));
  expect(error.message).toContain("unknown_error");
  expect(error.message).not.toContain("private@example.com");
  expect(error.message).not.toContain("Guest details");
});
test("non-JSON provider errors preserve the HTTP failure", async () => {
  expect((await resendFailure(new Response("upstream error", { status: 502 }))).message).toContain("502, unknown_error");
});
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
const sends = mock(async (_input: unknown, _init?: RequestInit) => Response.json({ id: "email_test" }));
const reservation = {
  id: "NGM-TEST12", name: "Guest <script>", email: "guest@example.com",
  check_in: "2026-11-01", check_out: "2026-11-03", guests: 4, total_yen: 160000,
  status: "pending", stripe_session_id: "cs_test", paid_at: null,
};
const session = {
  id: "cs_test", mode: "payment", payment_status: "paid", currency: "jpy", amount_total: 160000,
  metadata: { reservation_id: reservation.id, lang: "ja" },
};
async function deliver(type = "checkout.session.completed", overrides: Row = {}, validSignature = true) {
  const body = JSON.stringify({ id: "evt_test", object: "event", type, data: { object: { ...session, ...overrides } } });
  const signature = await Stripe.webhooks.generateTestHeaderStringAsync({ payload: body, secret: "whsec_test" });
  return POST(new Request("http://localhost/api/stripe-webhook", {
    method: "POST", headers: { "stripe-signature": validSignature ? signature : "bad" }, body,
  }));
}
beforeEach(() => {
  tables = { reservations: [{ ...reservation, cancellation_state: null }], reservation_confirmation_emails: [], reservation_cancellations: [], reservation_cancellation_emails: [] };
  failSentUpdate = false;
  Object.assign(process.env, {
    STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: "whsec_test",
    RESERVATION_EMAILS_ENABLED: "true", RESEND_API_KEY: "re_fake",
    RESERVATION_EMAIL_FROM: "Nagomi <bookings@example.com>",
    RESERVATION_EMAIL_REPLY_TO: "nagomi.inn.miyazaki@gmail.com", HOTEL_ADDRESS: "Temporary address: Miyazaki",
  });
  sends.mockReset();
  sends.mockImplementation(async () => Response.json({ id: "email_test" }));
  globalThis.fetch = sends as unknown as typeof fetch;
});
afterAll(() => { globalThis.fetch = originalFetch; process.env = originalEnv; });
afterEach(() => setSystemTime());

test("signed paid booking is confirmed and sends Japanese details with a Gmail reply address", async () => {
  expect((await deliver()).status).toBe(200);
  expect(tables.reservations[0].status).toBe("confirmed");
  const payload = JSON.parse(sends.mock.calls[0][1]!.body as string);
  expect(payload.subject).toContain("ご予約が確定しました");
  expect(payload.text).toContain("¥160,000 JPY");
  expect(payload.text).toContain("2026-11-01 15:00 (JST)");
  expect(payload.reply_to).toBe("nagomi.inn.miyazaki@gmail.com");
  expect(payload.html).toContain("Guest &lt;script&gt;");
  expect(tables.reservation_confirmation_emails[0].sent_at).toBeTruthy();
});
test("unsigned requests never confirm or send", async () => {
  expect((await deliver(undefined, {}, false)).status).toBe(400);
  expect(tables.reservations[0].status).toBe("pending");
  expect(sends).not.toHaveBeenCalled();
});
test("dashboard wrapper quotes are removed before freezing a new email", async () => {
  process.env.RESERVATION_EMAIL_FROM = ' "Nagomi Inn <bookings@example.com>" ';
  process.env.RESERVATION_EMAIL_REPLY_TO = '"reply@example.com"';
  process.env.HOTEL_ADDRESS = '"宮崎県 / Miyazaki"';
  expect((await deliver()).status).toBe(200);
  const payload = JSON.parse(sends.mock.calls[0][1]!.body as string);
  expect(payload.from).toBe("Nagomi Inn <bookings@example.com>");
  expect(payload.reply_to).toBe("reply@example.com");
  expect(payload.text).toContain("住所: 宮崎県 / Miyazaki");
  expect(payload.html).not.toContain("&quot;");
});
test("unpaid completion waits for async payment success", async () => {
  expect((await deliver(undefined, { payment_status: "unpaid" })).status).toBe(200);
  expect(tables.reservations[0].status).toBe("pending");
  expect(sends).not.toHaveBeenCalled();
  expect((await deliver("checkout.session.async_payment_succeeded")).status).toBe(200);
  expect(sends).toHaveBeenCalledTimes(1);
});
test.each([{ amount_total: 1 }, { currency: "usd" }, { id: "cs_wrong" }])("mismatched payment is rejected: %j", async overrides => {
  expect((await deliver(undefined, overrides)).status).toBe(500);
  expect(tables.reservations[0].status).toBe("pending");
  expect(sends).not.toHaveBeenCalled();
});
test("expired and failed sessions release holds without email", async () => {
  expect((await deliver("checkout.session.expired")).status).toBe(200);
  expect(tables.reservations[0].status).toBe("cancelled");
  tables.reservations[0].status = "pending";
  expect((await deliver("checkout.session.async_payment_failed")).status).toBe(200);
  expect(tables.reservations[0].status).toBe("cancelled");
  expect(sends).not.toHaveBeenCalled();
});
test("duplicate events do not resend, including after the provider's 24-hour window", async () => {
  await deliver();
  tables.reservation_confirmation_emails[0].first_attempt_at = "2020-01-01T00:00:00Z";
  await deliver();
  await deliver("checkout.session.async_payment_succeeded");
  expect(sends).toHaveBeenCalledTimes(1);
});
test("email failure preserves payment and retries the frozen payload", async () => {
  sends.mockImplementationOnce(async () => new Response(null, { status: 429 }));
  expect((await deliver()).status).toBe(500);
  expect(tables.reservations[0].status).toBe("confirmed");
  process.env.HOTEL_ADDRESS = "A changed address";
  expect((await deliver()).status).toBe(200);
  expect(sends.mock.calls[0][1]!.body).toBe(sends.mock.calls[1][1]!.body);
  expect(sends.mock.calls[0][1]!.headers).toEqual(sends.mock.calls[1][1]!.headers);
});
test("lost DB acknowledgement retries with the same idempotency key", async () => {
  failSentUpdate = true;
  expect((await deliver()).status).toBe(500);
  failSentUpdate = false;
  expect((await deliver()).status).toBe(200);
  expect(sends.mock.calls[0][1]!.body).toBe(sends.mock.calls[1][1]!.body);
  expect(sends.mock.calls[0][1]!.headers).toEqual(sends.mock.calls[1][1]!.headers);
});
test("ambiguous sends older than the retry window require review", async () => {
  failSentUpdate = true;
  await deliver();
  tables.reservation_confirmation_emails[0].first_attempt_at = "2020-01-01T00:00:00Z";
  expect((await deliver()).status).toBe(500);
  expect(sends).toHaveBeenCalledTimes(1);
});
test("cancelled bookings stay cancelled on replay", async () => {
  tables.reservations[0].status = "cancelled";
  expect((await deliver()).status).toBe(200);
  expect(tables.reservations[0].status).toBe("cancelled");
  expect(sends).not.toHaveBeenCalled();
});
test("disabled email feature keeps existing payments working", async () => {
  process.env.RESERVATION_EMAILS_ENABLED = "false";
  expect((await deliver()).status).toBe(200);
  expect(tables.reservations[0].status).toBe("confirmed");
  expect(sends).not.toHaveBeenCalled();
});
test("missing email configuration reports failure while preserving confirmation", async () => {
  delete process.env.RESEND_API_KEY;
  expect((await deliver()).status).toBe(500);
  expect(tables.reservations[0].status).toBe("confirmed");
  expect(sends).not.toHaveBeenCalled();
});
test("English template includes hotel details and escapes user input", () => {
  const email = confirmationEmail(reservation, "en", { from: "bookings@example.com", replyTo: "nagomi.inn.miyazaki@gmail.com", address: "Temporary <address>" });
  expect(email.subject).toContain("Your reservation is confirmed");
  expect(email.html).toContain("Temporary &lt;address&gt;");
  expect(email.text).toContain("Nights: 2");
  expect(email.text).toContain("Check-out: 2026-11-03 10:00 (JST)");
});

const asAdmin = admin as unknown as SupabaseClient;
function cancellationFixture(status = "succeeded") {
  setSystemTime(new Date("2026-11-01T00:00:00Z"));
  const booking = { ...reservation, check_in: "2026-12-02", check_out: "2026-12-03", status: "confirmed", paid_at: "2026-10-01T00:00:00Z", cancellation_state: null };
  tables.reservations = [booking];
  let refund = {
    id: "re_test", amount: booking.total_yen, currency: "jpy", payment_intent: "pi_test", status,
    metadata: { cancellation_reservation_id: booking.id },
  };
  const create = mock(async (params: { amount: number }, _options: unknown) => {
    refund = { ...refund, amount: params.amount };
    return { ...refund };
  });
  const retrieve = mock(async () => ({ ...refund }));
  const stripe = {
    checkout: { sessions: { retrieve: mock(async () => ({ ...session, payment_intent: "pi_test" })) } },
    refunds: { create, retrieve },
  } as unknown as Stripe;
  return { booking, stripe, create, retrieve, refund: () => refund };
}

test("successful cancellation sends one email with full refund and does not refund again", async () => {
  const { booking, stripe, create } = cancellationFixture();
  const result = await requestCancellation(asAdmin, stripe, booking, "en");
  expect(result).toMatchObject({ cancelled: true, refundYen: 160000, refundPercent: 100 });
  expect(tables.reservations[0].status).toBe("cancelled");
  const payload = JSON.parse(sends.mock.calls[0][1]!.body as string);
  expect(payload.subject).toContain("Your reservation has been cancelled");
  expect(payload.text).toContain("Refund amount: ¥160,000 JPY");
  expect(payload.text).toContain("Cancellation fee: ¥0 JPY");
  expect(payload.text).not.toContain("Your stay is confirmed");
  await requestCancellation(asAdmin, stripe, booking, "ja");
  expect(create).toHaveBeenCalledTimes(1);
  expect(sends).toHaveBeenCalledTimes(1);
});

test("partial refund amount is frozen across retries and policy boundaries", async () => {
  const { booking, stripe, create, refund } = cancellationFixture("pending");
  booking.check_in = "2026-11-04";
  booking.check_out = "2026-11-05";
  const first = await requestCancellation(asAdmin, stripe, booking, "ja");
  expect(first).toMatchObject({ pending: true, cancelled: false, refundYen: 80000 });
  setSystemTime(new Date("2026-11-04T00:00:00Z"));
  await requestCancellation(asAdmin, stripe, booking, "en");
  expect(create).toHaveBeenCalledTimes(1);
  expect(tables.reservation_cancellations[0].refund_yen).toBe(80000);
  expect(tables.reservation_cancellations[0].lang).toBe("ja");
  await applyCancellationRefund(asAdmin, { ...refund(), status: "succeeded" } as Stripe.Refund);
  const payload = JSON.parse(sends.mock.calls[0][1]!.body as string);
  expect(payload.text).toContain("返金額: ¥80,000 JPY");
  expect(payload.text).toContain("キャンセル料: ¥80,000 JPY");
});

test.each(["pending", "requires_action"])("refund %s does not cancel or email until success", async status => {
  const { booking, stripe, refund } = cancellationFixture(status);
  expect(await requestCancellation(asAdmin, stripe, booking, "en")).toMatchObject({ pending: true, cancelled: false });
  expect(tables.reservations[0].status).toBe("confirmed");
  expect(tables.reservations[0].cancellation_state).toBe("processing");
  expect(sends).not.toHaveBeenCalled();
  await applyCancellationRefund(asAdmin, { ...refund(), status: "succeeded" } as Stripe.Refund);
  await applyCancellationRefund(asAdmin, { ...refund(), status: "succeeded" } as Stripe.Refund);
  expect(tables.reservations[0].status).toBe("cancelled");
  expect(sends).toHaveBeenCalledTimes(1);
});

test.each(["failed", "canceled"])("refund %s keeps booking and requires assistance without retrying money", async status => {
  const { booking, stripe, create } = cancellationFixture(status);
  expect(await requestCancellation(asAdmin, stripe, booking, "en")).toMatchObject({ refundFailed: true, cancelled: false });
  expect(tables.reservations[0].status).toBe("confirmed");
  expect(tables.reservations[0].cancellation_state).toBe("failed");
  expect(sends).not.toHaveBeenCalled();
  await requestCancellation(asAdmin, stripe, booking, "en");
  expect(create).toHaveBeenCalledTimes(1);
});

test("no-refund cancellation completes immediately; a failed email can be retried by the sweep", async () => {
  const { booking, stripe, create } = cancellationFixture();
  booking.check_in = "2026-11-01";
  booking.check_out = "2026-11-02";
  sends.mockImplementationOnce(async () => new Response(null, { status: 503 }));
  expect(await requestCancellation(asAdmin, stripe, booking, "en")).toMatchObject({ cancelled: true, refundYen: 0, emailPending: true });
  expect(create).not.toHaveBeenCalled();
  expect(tables.reservations[0].status).toBe("cancelled");
  expect(await retryCancellations(asAdmin, stripe)).toMatchObject({ failed: 0 });
  expect(tables.reservation_cancellation_emails[0].sent_at).toBeTruthy();
  const payload = JSON.parse(sends.mock.calls[1][1]!.body as string);
  expect(payload.text).toContain("No refund is due");
});

test("refund success email failure retries without creating another refund", async () => {
  const { booking, stripe, refund, create } = cancellationFixture();
  sends.mockImplementationOnce(async () => new Response(null, { status: 503 }));
  expect(await requestCancellation(asAdmin, stripe, booking, "en")).toMatchObject({ cancelled: true, emailPending: true });
  await applyCancellationRefund(asAdmin, refund() as Stripe.Refund);
  expect(create).toHaveBeenCalledTimes(1);
  expect(sends).toHaveBeenCalledTimes(2);
  expect(sends.mock.calls[0][1]!.headers).toEqual(sends.mock.calls[1][1]!.headers);
});

test("refund API timeout retains a durable request and stable idempotency key", async () => {
  const { booking, stripe, create } = cancellationFixture();
  create.mockImplementationOnce(async () => { throw new Error("timeout"); });
  await expect(requestCancellation(asAdmin, stripe, booking, "en")).rejects.toThrow("timeout");
  expect(tables.reservations[0].status).toBe("confirmed");
  await requestCancellation(asAdmin, stripe, booking, "en");
  expect(create.mock.calls[0]).toEqual(create.mock.calls[1]);
});

test("old ambiguous refund attempts cannot create a second partial refund", async () => {
  const { booking, stripe, create } = cancellationFixture();
  create.mockImplementationOnce(async () => { throw new Error("timeout"); });
  await expect(requestCancellation(asAdmin, stripe, booking, "en")).rejects.toThrow();
  tables.reservation_cancellations[0].first_attempt_at = "2020-01-01T00:00:00Z";
  await expect(requestCancellation(asAdmin, stripe, booking, "en")).rejects.toThrow("owner review");
  expect(create).toHaveBeenCalledTimes(1);
});

test("mismatched refund cannot cancel a booking or send an email", async () => {
  const { booking, stripe, refund } = cancellationFixture("pending");
  await requestCancellation(asAdmin, stripe, booking, "en");
  await expect(applyCancellationRefund(asAdmin, { ...refund(), amount: 1, status: "succeeded" } as Stripe.Refund)).rejects.toThrow("mismatch");
  expect(tables.reservations[0].status).toBe("confirmed");
  expect(sends).not.toHaveBeenCalled();
});

test("bank failure after cancellation does not revive dates or send a second success email", async () => {
  const { booking, stripe, refund } = cancellationFixture();
  await requestCancellation(asAdmin, stripe, booking, "en");
  await applyCancellationRefund(asAdmin, { ...refund(), status: "failed" } as Stripe.Refund);
  expect(tables.reservations[0].status).toBe("cancelled");
  expect(tables.reservations[0].cancellation_state).toBe("failed");
  expect(sends).toHaveBeenCalledTimes(1);
});

test("unrelated dashboard refunds do not cancel reservations", async () => {
  expect(await applyCancellationRefund(asAdmin, { metadata: {} } as Stripe.Refund)).toBeNull();
  expect(sends).not.toHaveBeenCalled();
});

test("signed refund webhook uses latest Stripe state instead of an older pending event", async () => {
  const { booking, stripe, refund } = cancellationFixture("pending");
  await requestCancellation(asAdmin, stripe, booking, "en");
  sends.mockImplementation(async (input) => {
    if (String(input).includes("api.stripe.com")) return Response.json({ ...refund(), status: "succeeded" });
    return Response.json({ id: "email_test" });
  });
  expect((await deliver("refund.updated", refund())).status).toBe(200);
  expect(tables.reservations[0].status).toBe("cancelled");
  expect(tables.reservation_cancellation_emails[0].sent_at).toBeTruthy();
});

test("invalid refund webhook signature cannot finish a pending cancellation", async () => {
  const { booking, stripe, refund } = cancellationFixture("pending");
  await requestCancellation(asAdmin, stripe, booking, "en");
  expect((await deliver("refund.updated", { ...refund(), status: "succeeded" }, false)).status).toBe(400);
  expect(tables.reservations[0].status).toBe("confirmed");
  expect(sends).not.toHaveBeenCalled();
});

test("concurrent cancellation requests use identical refund idempotency keys", async () => {
  const { booking, stripe, create } = cancellationFixture("pending");
  await Promise.all([
    requestCancellation(asAdmin, stripe, booking, "ja"),
    requestCancellation(asAdmin, stripe, booking, "en"),
  ]);
  expect(tables.reservation_cancellations).toHaveLength(1);
  expect(create.mock.calls.length).toBeGreaterThan(0);
  for (const call of create.mock.calls) expect(call).toEqual(create.mock.calls[0]);
  expect(sends).not.toHaveBeenCalled();
});
