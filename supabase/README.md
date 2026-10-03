# Database migrations

Every schema change lives in `migrations/`, one file per change, named
`<timestamp>_<name>.sql`. **Filename order is run order.** (It's also the naming
the Supabase CLI uses, so these can move to `supabase db push` later.)

We have two Supabase projects — staging and production — and each needs every
migration, run by hand in that project's SQL editor.

## Which ones has a database had?

Paste `migration-status.sql` into the project's SQL editor and run it. It's
read-only: each row checks for something that migration created, and shows
✓ applied or ✗ not applied.

Then run each ✗ file, top to bottom. **Never re-run a ✓ file** — the early ones
would undo later changes (e.g. re-running the initial schema re-opens direct
booking inserts that `server_only_bookings` closed).

## Adding a migration

1. Create `migrations/<YYYYMMDDHHMMSS>_<what_it_does>.sql` (current time, so it
   sorts last). Say in its header whether it must run before or after the code
   that uses it is deployed.
2. Add a row for it to `migration-status.sql` that checks for something it
   creates.
3. Run it on staging, then on production before merging to `main`.
