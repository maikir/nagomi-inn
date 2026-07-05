# 和 NAGOMI — Inn website

Website for **田舎民泊 和 / Nagomi Inn Miyazaki** — a private two-house inn with a barrel
sauna for up to 16 guests. Built with Next.js 14 (App Router) + Tailwind, ready for
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

## Reservations: demo mode → Supabase

The UI talks only to the `ReservationStore` interface (`src/lib/reservations/types.ts`).
Two implementations exist:

- **`LocalReservationStore`** *(active now)* — stores reservations in the visitor's
  browser localStorage. Full flow works: availability calendar, double-booking
  prevention, confirmation codes, viewing and cancelling.
- **`SupabaseReservationStore`** — same contract against Postgres (`bun add @supabase/supabase-js` is already done). The database schema
  (`supabase/schema.sql`) enforces no-overlapping-stays at the database level with an
  exclusion constraint, so double bookings are impossible even under race conditions.

To switch: create a Supabase project, run `supabase/schema.sql` in its SQL editor, then
set in `.env.local` (and on Vercel):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The store factory (`src/lib/reservations/index.ts`) detects the vars and switches
automatically. No other code changes.

> ⚠ The included RLS policies are demo-grade (public read/insert). Before taking real
> bookings, move writes behind a server route and add payments/auth as needed.
> A Redis layer (e.g. Upstash) could later front `bookedDates()` for caching, but at
> this traffic level Postgres alone is plenty.

## Languages

EN / 日本語 toggle lives in the nav (top right). Preference persists in localStorage and
auto-detects Japanese browsers on first visit. All copy lives in one file:
`src/lib/i18n/dictionaries.ts`.
