# 和 NAGOMI — Inn website

Website for **田舎民泊 和 / Nagomi Inn Miyazaki** — a private two-house inn with a barrel
sauna for up to 18 guests. Built with Next.js 14 (App Router) + Tailwind, ready for
Vercel, with a reservation system that runs on browser localStorage today and swaps to
Supabase by setting two environment variables.

## Run locally

Uses [bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash` if you don't have it):

```bash
bun install
bun run dev        # http://localhost:3000
```

## Environment files

All three files use the same sections: Supabase, Stripe, owner dashboard,
reservation emails, and calendar sync.

- `.env.example`: safe template with empty credentials.
- `.env.local`: private local configuration, loaded automatically by Next.js.
- `.env.staging`: private staging settings reference. Next.js does **not** load
  this filename automatically; apply its values to the staging deployment's
  environment settings in Vercel.

Keep credentials specific to each environment. Restart the local server after
editing `.env.local`; redeploy after changing Vercel settings. Both private files
are ignored by Git. The email sender is
`Nagomi Inn <reservations@nagomi-inn-miyazaki.com>`, with replies routed to
`nagomi.inn.miyazaki@gmail.com`. A Resend key and the email database migration
are still required before enabling sending.

## Deploy to Vercel

1. Push this folder to a GitHub repo (`git init && git add -A && git commit -m "init"`).
2. Import the repo at vercel.com — no configuration needed, it detects Next.js.
3. Done. (Add the Supabase env vars later when you're ready — see below.)

## Things you'll want to edit

| What | Where |
|---|---|
| **Contact info (email / phone / Instagram)** — currently placeholders | `src/config/site.ts` |
| Pricing (base rate, per-guest rate, cleaning fee) — placeholder values | `src/config/site.ts` |
| All site text, EN & JA | `src/lib/i18n/dictionaries.ts` |
| Photos | `public/images/` (referenced in `src/components/home/*.tsx`) |
| House names / descriptions (母屋・離れ are editable suggestions) | `src/lib/i18n/dictionaries.ts` → `spaces` |

## Reservations & login: demo mode → Supabase

The UI talks only to the `ReservationStore` interface (`src/lib/reservations/types.ts`).
Two implementations exist:

- **`LocalReservationStore`** — active when no Supabase env vars are set. Reservations
  live in the visitor's browser localStorage; no login. Good for previewing.
- **`SupabaseReservationStore`** — real database + accounts. Guests sign in
  (Google / Apple / email+password) to confirm a reservation; RLS scopes reads and
  cancellations to each guest's own bookings; public availability comes from the
  dates-only `booked_ranges` view (no personal data exposed). The exclusion
  constraint in Postgres makes overlapping confirmed stays impossible, even under
  race conditions.

### Switching Supabase on

1. **Database** — run `supabase/schema.sql` in the Supabase SQL editor once.
2. **Env vars** — copy `.env.example` to `.env.local` and paste the Project URL and
   anon key (Project Settings → API). Add the same two vars in Vercel.
3. **Auth providers** — Supabase dashboard → Authentication:
   - *Email* is on by default (leave "Confirm email" on).
   - *Google*: create an OAuth client in Google Cloud Console, paste its ID/secret.
   - *Apple*: needs an Apple Developer account (Services ID + key). Optional at first.
   - *URL Configuration*: set Site URL to the production domain; add
     `http://localhost:3000/**` to Redirect URLs for local dev.
4. **LINE** is not natively supported by Supabase Auth. If it becomes important,
   the options are a custom OIDC bridge (Edge Function) or an aggregator like WorkOS.

The store factory (`src/lib/reservations/index.ts`) detects the env vars and switches
automatically. The owner sees all bookings in the Supabase dashboard (Table Editor).

## Payments (Stripe)

With payments on, bookings flow: confirm → `/api/checkout` holds the dates as a
`pending` reservation and computes the price **server-side** → Stripe-hosted Checkout
→ webhook flips the reservation to `confirmed` (or frees the dates if the session
expires unpaid after 30 min). Cancelled payments return to the reserve page with the
form intact.

Setup:
1. Run `supabase/stripe-ical-migration.sql` in the Supabase SQL editor.
   ⚠ After this migration, bookings REQUIRE payment — direct client confirmation is
   blocked at the database level. Do it when you're ready to set the env vars.
2. Stripe dashboard (test mode first): copy the secret key; add a webhook endpoint
   `https://<domain>/api/stripe-webhook` for `checkout.session.completed` and
   `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and
   `checkout.session.async_payment_failed`; copy its signing secret.
3. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
   and `NEXT_PUBLIC_PAYMENTS=stripe` (locally in `.env.local` and on Vercel), redeploy.
4. Local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe-webhook`.

Test card: `4242 4242 4242 4242`, any future expiry/CVC. The webhook waits for
`payment_status=paid`, including delayed-payment success events. Adding delayed
payment methods such as konbini also needs a hold-expiry policy that accommodates
their settlement time; the existing checkout hold is only 30 minutes.

## Reservation confirmation emails (Resend)

Paid direct bookings can send one confirmation to the email entered on the
reservation form. The server verifies the Stripe signature, paid status, amount,
currency, and session association before confirming and emailing. The message
includes the booking number, property, address, dates and times (JST), nights,
guests, amount paid, and contact details. It follows the checkout language (English
or Japanese; older sessions default to English). Demo bookings do not send emails.

Resend delivers the email using its HTTP API; a small HTML/plain-text template
keeps this dependency-free. React Email is optional for more elaborate designs.

### Enable sending

1. Create a [Resend account](https://resend.com), add a domain you own, and verify
   it with the DNS records Resend supplies. Create an API key with sending access.
   Gmail can be the reply-to address, but cannot be your verified sender domain.
2. Run `supabase/reservation-emails.sql` in the Supabase SQL editor after the
   existing payment migration. This adds a private record of each confirmation.
3. Add the email settings from `.env.example` to `.env.local` for local testing
   and to Vercel for deployment:
   - `RESEND_API_KEY`: your private Resend key.
   - `RESERVATION_EMAIL_FROM`: e.g. `Nagomi Inn <reservations@your-domain.com>`
     using your verified domain.
   - `RESERVATION_EMAIL_REPLY_TO`: `nagomi.inn.miyazaki@gmail.com`.
   - `HOTEL_ADDRESS`: the address shown in confirmations. The example file has
     clearly marked temporary text; replace it with the real address when ready.
   - `RESERVATION_EMAILS_ENABLED=true`: enable only after the settings and migration
     are ready. Unset or `false` preserves the existing flow without emails.
4. Subscribe the Stripe endpoint to all four events listed above and redeploy.
5. Complete a Stripe **test-mode** checkout using an inbox you control. Check the
   email, the confirmed reservation, and Resend's delivery log. Resend's testing
   sender (`onboarding@resend.dev`) only permits delivery to your account email;
   use a verified domain for other recipients. Stripe test mode still sends a real
   email when this feature is enabled.

The address and reply-to are server environment settings and can be changed later
without editing the template (redeploy/restart after changing them). Guest contact
details elsewhere on the site live in `src/config/site.ts`.

### Retries and troubleshooting

An email error returns HTTP 500 so Stripe retries its webhook; the paid reservation
stays confirmed. A private `reservation_confirmation_emails` row freezes the exact
payload, and a stable Resend idempotency key protects concurrent/repeated attempts.
Once Resend accepts the message, `sent_at` and `resend_email_id` are stored, so
later webhook replays skip sending. `sent_at` means **accepted by Resend**, not
necessarily delivered; use Resend's logs to inspect bounces and delivery.

Resend retains idempotency keys for 24 hours. Unacknowledged attempts older than
23 hours stop with an operator-review error instead of risking a duplicate.
Check Vercel/Stripe failed webhook logs and Resend for the booking's recipient and
subject. If Resend already accepted the email, record its ID and acceptance time
in the row. Only if you establish that it was never accepted, clear
`first_attempt_at` and replay the original paid Stripe event. Do not delete sent
rows to retry. Stripe retries are finite: investigate persistent failures and
manually replay the event after fixing configuration or provider issues.

Payloads are frozen at the first attempt; changing environment settings changes
new confirmations, not queued ones. Bookings completed while sending is disabled
are not automatically backfilled. A cancelled booking is skipped on replay.

Run `bun run test:email` for isolated webhook/template tests. Tests mock database
and email transport, verify real Stripe signatures, and never send actual emails.

**Cancellations & refunds:** in-app cancellation goes through `/api/cancel`, which
refunds the Stripe payment in full when the guest cancels at least
`site.cancellation.fullRefundUntilDaysBefore` days before check-in (default 7 —
edit in `src/config/site.ts`), and releases the dates either way. Refund-eligible
cancellations only complete if the refund succeeds. Partial-refund tiers or
owner-initiated cancellations: use the Stripe dashboard.

## Airbnb / Booking.com calendar sync (iCal)

Two directions, both dates-only:

- **Export** — `/api/calendar.ics?token=…` lists direct bookings (confirmed + pending
  holds). Paste this URL into Airbnb → Calendar → Availability → Import calendar, and
  Booking.com → Rates & Availability → Sync calendars.
- **Import** — the OTAs' export links go in `ICAL_IMPORT_URLS`. The sync writes them
  to `external_blocks`; the availability calendar and a database trigger both treat
  those dates as taken. Sync runs (a) daily via Vercel Cron (`vercel.json`) and
  (b) automatically during any checkout if data is older than 15 minutes — so the
  riskiest moment (a guest about to pay) always checks fresh data. Trigger it
  manually anytime: `GET /api/ical-sync?token=<CRON_SECRET>`.

Known limitation of iCal (all platforms): OTAs re-read your feed only every 1–3 h, so
a short double-booking window exists in the OTA→OTA and website→OTA directions. For a
single property this is normally acceptable; if volume grows, a channel manager
(Beds24, Smoobu, …) with API-level sync is the upgrade path.

> A Redis cache in front of `bookedDates()` is unnecessary at this traffic level.

## Languages

EN / 日本語 toggle lives in the nav (top right). Preference persists in localStorage and
auto-detects Japanese browsers on first visit. All copy lives in one file:
`src/lib/i18n/dictionaries.ts`.
