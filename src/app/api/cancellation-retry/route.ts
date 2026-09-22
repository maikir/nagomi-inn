import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { retryCancellations } from "@/lib/server/cancellation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron, or a manual authenticated retry on staging. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getSupabaseAdmin();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!admin || !key) return NextResponse.json({ error: "not configured" }, { status: 501 });
  try {
    const result = await retryCancellations(admin, new Stripe(key));
    return NextResponse.json(result, { status: result.failed ? 502 : 200 });
  } catch {
    return NextResponse.json({ error: "cancellation retry failed" }, { status: 500 });
  }
}
