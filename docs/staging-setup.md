# Staging environment — runbook

A separate **test site** for trying payments and other risky changes before they
reach real guests. Same code, different keys.

```
main     → nagomi-inn-miyazaki.com        → Vercel "Production"  → Stripe LIVE  (later)
staging  → test.nagomi-inn-miyazaki.com   → Vercel "Preview"     → Stripe TEST  (now)
```

The trick: **one** Vercel project. Vercel scopes environment variables to
Production / Preview / Development separately, so the same commit runs with
different Stripe + Supabase keys depending on which branch deployed it.

Workflow: push to `staging` to test → when proven, merge `staging` into `main`
to ship.

---

## One-time setup

### 1. Vercel — map the subdomain to the branch
Project → **Settings → Domains** → add `test.nagomi-inn-miyazaki.com` → assign it
to the **`staging`** branch (Vercel calls this a "branch domain").
- If the domain's DNS is managed by Vercel, this is automatic.
- Otherwise add a `CNAME` record: `test` → `cname.vercel-dns.com`.

### 2. Supabase — a separate staging project (recommended)
Create a second project, e.g. **nagomi-staging**. Test data, test auth users, and
the payments migration all stay isolated from production. In its SQL editor run,
in order:
1. `supabase/schema.sql`
2. `supabase/2026-08-max-guests-18.sql`
3. `supabase/stripe-ical-migration.sql`  ← safe to trial here first

> Running the Stripe migration makes payment **mandatory** and alters table
> constraints/policies. Proving it on staging first is the whole point.

### 3. Stripe — a webhook per environment
In **Test mode**, create a webhook (Developers → Webhooks → Add endpoint):
- URL: `https://test.nagomi-inn-miyazaki.com/api/stripe-webhook`
- Events: `checkout.session.completed`, `checkout.session.expired`
- Its signing secret (`whsec_…`) is the **Preview** `STRIPE_WEBHOOK_SECRET`.

Production gets its own separate webhook (live mode) later.

### 4. Vercel env vars — scope everything to **Preview**
Settings → Environment Variables → add each with the **Preview** box checked
(and Preview only, so they never leak into Production):

| Variable | Preview (staging) value |
|---|---|
| `NEXT_PUBLIC_PAYMENTS` | `stripe` |
| `STRIPE_SECRET_KEY` | `sk_test_…` (test mode) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the staging webhook (step 3) |
| `SUPABASE_SERVICE_ROLE_KEY` | staging project's service_role key |
| `NEXT_PUBLIC_SUPABASE_URL` | staging project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging project anon key |
| `ICAL_EXPORT_TOKEN` / `CRON_SECRET` | any fresh random strings |

Redeploy the `staging` branch after setting these.

### 5. Supabase Auth (staging project) — allow the staging domain
Authentication → URL Configuration:
- Site URL: `https://test.nagomi-inn-miyazaki.com`
- Redirect URLs: add `https://test.nagomi-inn-miyazaki.com/**` (and
  `http://localhost:3000/**` for local dev)
- Re-add Google/Apple OAuth credentials pointing at the staging callback.

---

## Testing a booking on staging
1. Open `https://test.nagomi-inn-miyazaki.com`, sign in.
2. Reserve dates → pay with Stripe test card `4242 4242 4242 4242`
   (any future expiry, any CVC).
3. Confirm the reservation flips to **confirmed** in the staging Supabase
   `reservations` table, and the Stripe **test** dashboard shows the payment.
4. Cancel it from "My reservations" → confirm the refund appears in the Stripe
   test dashboard (amount = the policy tier).

## Going live (later)
Set the **Production**-scoped versions of every variable above with LIVE values
(`sk_live_…`, a live-mode webhook at `nagomi-inn-miyazaki.com/api/stripe-webhook`,
the production Supabase project), run the SQL migrations on the production DB,
then merge `staging` → `main`.
