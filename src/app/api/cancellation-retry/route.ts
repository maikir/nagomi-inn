import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { retryCancellations } from "@/lib/server/cancellation";
import { sendDueThankYous } from "@/lib/server/thankYou";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The daily job (Vercel Cron, 04:00 UTC = 13:00 JST), or a manual authenticated
 * run on staging: retries unfinished cancellations, then sends post-stay
 * thank-you emails. The steps are independent — one failing never skips the other.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getSupabaseAdmin();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!admin || !key) return NextResponse.json({ error: "not configured" }, { status: 501 });

  const cancellations = await retryCancellations(admin, new Stripe(key)).catch((e) => {
    console.error("cancellation retry failed:", e instanceof Error ? e.message : e);
    return { error: "cancellation retry failed" } as const;
  });
  const thankYou = await sendDueThankYous(admin).catch((e) => {
    console.error("thank-you emails failed:", e instanceof Error ? e.message : e);
    return { error: "thank-you emails failed" } as const;
  });

  const failed = "error" in cancellations || cancellations.failed > 0 || "error" in thankYou || thankYou.failed > 0;
  return NextResponse.json({ cancellations, thankYou }, { status: failed ? 502 : 200 });
}
