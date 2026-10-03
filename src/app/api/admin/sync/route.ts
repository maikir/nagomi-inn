import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/server/admin";
import { syncExternalCalendars, parseImportUrls } from "@/lib/server/icalSync";

/**
 * POST /api/admin/sync
 * Owner-triggered "refresh calendars now". Same allowlist gate as the rest of
 * the dashboard — deliberately NOT the CRON_SECRET, so no secret reaches the
 * browser. Pulls the Airbnb / Booking.com feeds into external_blocks on demand.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.status === 403 ? "FORBIDDEN" : "AUTH_REQUIRED" }, { status: auth.status });
  }

  if (parseImportUrls().length === 0) {
    return NextResponse.json({ configured: false, synced: [] });
  }

  const results = await syncExternalCalendars();
  const failed = results.some((r) => r.error);
  return NextResponse.json(
    { configured: true, synced: results, syncedAt: new Date().toISOString() },
    { status: failed ? 502 : 200 },
  );
}
