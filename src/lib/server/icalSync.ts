import { parseIcs } from "./ical";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Pulls Airbnb / Booking.com availability feeds into external_blocks.
 *
 * Feed list comes from ICAL_IMPORT_URLS, e.g.:
 *   ICAL_IMPORT_URLS="airbnb=https://www.airbnb.com/calendar/ical/XXX.ics,booking=https://admin.booking.com/hotel/XXX.ics"
 *
 * Called from the Vercel cron route (baseline) and inline from /api/checkout
 * when the data is stale — so availability is freshest at the moment of
 * booking, whatever the cron cadence.
 */

export function parseImportUrls(): { source: string; url: string }[] {
  const raw = process.env.ICAL_IMPORT_URLS ?? "";
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      return { source: pair.slice(0, eq).trim(), url: pair.slice(eq + 1).trim() };
    })
    .filter((p) => p.source && p.url.startsWith("http"));
}

export type SyncResult = { source: string; events: number; error?: string };

export async function syncExternalCalendars(opts?: { ifStaleMinutes?: number }): Promise<SyncResult[]> {
  const admin = getSupabaseAdmin();
  const feeds = parseImportUrls();
  if (!admin || feeds.length === 0) return [];

  // Staleness gate (used by the inline checkout sync).
  if (opts?.ifStaleMinutes) {
    const { data } = await admin.from("ical_sync_state").select("synced_at");
    const newest = (data ?? [])
      .map((r) => new Date(r.synced_at as string).getTime())
      .reduce((a, b) => Math.max(a, b), 0);
    const fresh = newest > Date.now() - opts.ifStaleMinutes * 60_000;
    if (fresh && (data ?? []).length >= feeds.length) return [];
  }

  const results: SyncResult[] = [];
  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "nagomi-inn-ical-sync" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const events = parseIcs(await res.text());

      if (events.length > 0) {
        const { error: upsertErr } = await admin.from("external_blocks").upsert(
          events.map((e) => ({
            source: feed.source,
            uid: e.uid,
            check_in: e.start,
            check_out: e.end,
            summary: e.summary ?? null,
            synced_at: new Date().toISOString(),
          })),
          { onConflict: "source,uid" },
        );
        if (upsertErr) throw upsertErr;
      }

      // Events gone from the feed are cancellations — free those dates.
      const keepUids = events.map((e) => e.uid);
      const del = admin.from("external_blocks").delete().eq("source", feed.source);
      const { error: delErr } = await (keepUids.length > 0
        ? del.not("uid", "in", `(${keepUids.map((u) => `"${u.replace(/"/g, "")}"`).join(",")})`)
        : del);
      if (delErr) throw delErr;

      await admin.from("ical_sync_state").upsert({
        source: feed.source,
        synced_at: new Date().toISOString(),
        events: events.length,
      });
      results.push({ source: feed.source, events: events.length });
    } catch (e) {
      results.push({ source: feed.source, events: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
