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

> Notes for real launch: prices are still computed client-side (move the total into a
> database trigger or server route before taking money), and there's no payment step.
> A Redis cache in front of `bookedDates()` is unnecessary at this traffic level.

## Languages

EN / 日本語 toggle lives in the nav (top right). Preference persists in localStorage and
auto-detects Japanese browsers on first visit. All copy lives in one file:
`src/lib/i18n/dictionaries.ts`.
