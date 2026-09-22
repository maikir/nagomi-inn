import { afterAll, beforeEach, expect, mock, test } from "bun:test";
import Stripe from "stripe";
import { confirmationEmail } from "../src/lib/server/reservationEmail";

// In-memory DB and HTTP transport: no real bookings, payments, or emails.
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let failSentUpdate = false;
const admin = {
  from(table: string) {
    let action = "select";
    let values: Row = {};
    const filters: ((row: Row) => boolean)[] = [];
    const query = {
      select() { return query; },
      update(input: Row) { action = "update"; values = input; return query; },
      upsert(input: Row) { action = "upsert"; values = input; return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      is(key: string, value: unknown) { return query.eq(key, value); },
      not(key: string) { filters.push(row => row[key] != null); return query; },
      single() { return query; },
      maybeSingle() { return query; },
      then(resolve: (value: { data: Row | null; error: unknown }) => unknown) {
        if (action === "upsert" && !tables[table].some(row => row.reservation_id === values.reservation_id)) {
          tables[table].push({ first_attempt_at: null, sent_at: null, ...values });
        }
        const rows = tables[table].filter(row => filters.every(filter => filter(row)));
        if (action === "update" && values.sent_at && failSentUpdate) {
          return Promise.resolve(resolve({ data: null, error: new Error("simulated DB failure") }));
        }
        if (action === "update") rows.forEach(row => Object.assign(row, values));
        return Promise.resolve(resolve({ data: rows[0] ? { ...rows[0] } : null, error: null }));
      },
    };
    return query;
  },
};
mock.module("../src/lib/server/supabaseAdmin", () => ({ getSupabaseAdmin: () => admin }));
const { POST } = await import("../src/app/api/stripe-webhook/route");
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
  tables = { reservations: [{ ...reservation }], reservation_confirmation_emails: [] };
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
