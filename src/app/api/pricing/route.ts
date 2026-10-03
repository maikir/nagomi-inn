import { NextResponse } from "next/server";
import { getEffectivePricing } from "@/lib/server/pricing";

/**
 * GET /api/pricing — public. The current effective pricing, so the reserve page
 * shows the same figures the checkout route will charge. Never cached (the owner
 * can change it at any time).
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const pricing = await getEffectivePricing();
  return NextResponse.json(pricing, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
