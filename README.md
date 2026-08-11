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
   `checkout.session.expired`; copy its signing secret.
3. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
   and `NEXT_PUBLIC_PAYMENTS=stripe` (locally in `.env.local` and on Vercel), redeploy.
4. Local webhook testing: `stripe listen --forward-to localhost:3000/api/stripe-webhook`.

Test card: `4242 4242 4242 4242`, any future expiry/CVC. To offer konbini payments to
domestic guests later, add `"konbini"` to `payment_method_types` in
`src/app/api/checkout/route.ts` and enable it in Stripe settings.

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
