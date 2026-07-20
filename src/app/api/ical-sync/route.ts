import { NextResponse } from "next/server";
import { syncExternalCalendars, parseImportUrls } from "@/lib/server/icalSync";

/**
 * GET /api/ical-sync
 * Pulls the Airbnb / Booking.com feeds into external_blocks.
 * Invoked by Vercel Cron (see vercel.json; Vercel adds the CRON_SECRET
 * Authorization header automatically) — or manually with ?token=CRON_SECRET.
 * The checkout route also runs this inline whenever data is >15 min old,
 * so the cron is a safety net, not the primary freshness mechanism.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 501 });

  const header = req.headers.get("authorization");
  const token = new URL(req.url).searchParams.get("token");
  if (header !== `Bearer ${secret}` && token !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (parseImportUrls().length === 0) {
    return NextResponse.json({ synced: [], note: "ICAL_IMPORT_URLS is empty" });
  }

  const results = await syncExternalCalendars();
  const failed = results.filter((r) => r.error);
  return NextResponse.json({ synced: results }, { status: failed.length > 0 ? 502 : 200 });
}
