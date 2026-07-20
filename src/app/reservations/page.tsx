"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLang, fill } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { formatYen, site } from "@/config/site";
import { getReservationStore, formatDate, nightsBetween, type Reservation } from "@/lib/reservations";

const PAYMENTS_ON = process.env.NEXT_PUBLIC_PAYMENTS === "stripe";

export default function ReservationsPage() {
  const { t, lang } = useLang();
  const { enabled: authEnabled, user, loading: authLoading } = useAuth();
  const store = useMemo(() => getReservationStore(), []);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const needsSignIn = authEnabled && !authLoading && !user;

  useEffect(() => {
    if (authEnabled && !user) {
      setReservations(null);
      return;
    }
    store.list().then(setReservations).catch(() => setReservations([]));
  }, [store, authEnabled, user]);

  if (needsSignIn) {
    return (
      <div className="mx-auto max-w-4xl px-5 pb-28 pt-28 md:px-8 md:pt-36">
        <p className="text-[11px] tracking-[0.35em] text-copper-bright">田舎民泊 和</p>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">{t.reservations.title}</h1>
        <div className="mt-16 border border-paper/15 bg-sumi-900 px-8 py-16 text-center">
          <p className="font-display text-2xl text-paper-dim">{t.auth.signInToView}</p>
          <Link
            href="/login?next=/reservations"
            className="mt-8 inline-block border border-copper px-8 py-4 text-xs tracking-[0.25em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950"
          >
            {t.auth.signIn.toUpperCase()}
          </Link>
        </div>
      </div>
    );
  }

  /** Cancelling ≥ policy-days before check-in refunds the payment in full. */
  function isRefundEligible(r: Reservation): boolean {
    const days = Math.floor((new Date(r.checkIn + "T00:00:00Z").getTime() - Date.now()) / 86_400_000);
    return days >= site.cancellation.fullRefundUntilDaysBefore;
  }

  async function confirmCancel(r: Reservation) {
    setNotice(null);
    setCancelBusy(true);
    try {
      if (PAYMENTS_ON && authEnabled) {
        // Paid bookings must cancel through the server so the Stripe refund
        // happens atomically with the status change.
        try {
          const session = (await getSupabase()?.auth.getSession())?.data.session;
          if (!session) throw new Error("no session");
          const res = await fetch("/api/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ id: r.id }),
          });
          const json = (await res.json().catch(() => ({}))) as { cancelled?: boolean; refunded?: boolean };
          if (!res.ok || !json.cancelled) throw new Error("cancel failed");
          setNotice({ tone: "ok", text: json.refunded ? t.reservations.cancelledRefunded : t.reservations.cancelledPlain });
        } catch {
          setNotice({ tone: "error", text: t.reservations.cancelError });
          setCancelling(null);
          return;
        }
      } else {
        await store.cancel(r.id);
        setNotice({ tone: "ok", text: t.reservations.cancelledPlain });
      }
      setReservations(await store.list());
      setCancelling(null);
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 pb-28 pt-28 md:px-8 md:pt-36">
      <p className="text-[11px] tracking-[0.35em] text-copper-bright">田舎民泊 和</p>
      <h1 className="mt-4 font-display text-4xl md:text-5xl">{t.reservations.title}</h1>
      <p className="mt-4 text-paper-dim">{t.reservations.subtitle}</p>

      {notice && (
        <p
          role="status"
          className={`mt-8 border px-5 py-4 text-sm ${
            notice.tone === "ok" ? "border-moss/60 bg-moss/10 text-paper" : "border-copper/60 bg-copper/10 text-copper-bright"
          }`}
        >
          {notice.text}
        </p>
      )}

      {reservations === null ? (
        <div className="mt-16 h-40 animate-pulse border border-paper/10 bg-sumi-900" />
      ) : reservations.length === 0 ? (
        <div className="mt-16 border border-paper/15 bg-sumi-900 px-8 py-16 text-center">
          <p className="font-display text-2xl text-paper-dim">{t.reservations.empty}</p>
          <Link
            href="/reserve"
            className="mt-8 inline-block border border-copper px-8 py-4 text-xs tracking-[0.25em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950"
          >
            {t.reservations.emptyCta.toUpperCase()}
          </Link>
        </div>
      ) : (
        <ul className="mt-12 space-y-6">
          {reservations.map((r) => {
            const nights = nightsBetween(r.checkIn, r.checkOut);
            const cancelled = r.status === "cancelled";
            const statusColor =
              r.status === "confirmed" ? "text-moss" : r.status === "pending" ? "text-copper-bright" : "text-paper-faint";
            return (
              <li
                key={r.id}
                className={`border bg-sumi-900 p-6 md:p-8 ${cancelled ? "border-paper/10 opacity-50" : "border-paper/15"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-[0.25em] text-paper-faint">
                      {r.id} ・{" "}
                      <span className={statusColor}>{t.reservations.status[r.status]}</span>
                    </p>
                    <p className="mt-3 font-display text-xl md:text-2xl">
                      {formatDate(r.checkIn, lang)} → {formatDate(r.checkOut, lang)}
                    </p>
                    <p className="mt-2 text-sm text-paper-dim">
                      {fill(nights === 1 ? t.reserve.nights_one : t.reserve.nights_other, { n: nights })} ・{" "}
                      {fill(r.guests === 1 ? t.reserve.guest_one : t.reserve.guest_other, { n: r.guests })} ・ {r.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] tracking-[0.2em] text-paper-faint">{t.reservations.totalLabel.toUpperCase()}</p>
                    <p className="mt-1 font-display text-2xl text-copper-bright">{formatYen(r.totalYen)}</p>
                  </div>
                </div>

                {/* Pending rows are mid-payment: cancelling here couldn't stop the
                    charge, so only confirmed stays offer cancellation. */}
                {r.status === "confirmed" && (
                  <div className="mt-6 border-t border-paper/10 pt-5">
                    {cancelling === r.id ? (
                      <div className="space-y-3">
                        <p className="text-sm text-copper-bright">{t.reservations.cancelConfirm}</p>
                        {PAYMENTS_ON && authEnabled && (
                          <p className="text-sm text-paper-dim">
                            {fill(
                              isRefundEligible(r) ? t.reservations.cancelRefundNote : t.reservations.cancelNoRefundNote,
                              { n: site.cancellation.fullRefundUntilDaysBefore },
                            )}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-4">
                          <button
                            onClick={() => confirmCancel(r)}
                            disabled={cancelBusy}
                            className="flex items-center gap-2.5 border border-copper px-4 py-2 text-xs tracking-[0.2em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950 disabled:pointer-events-none disabled:opacity-60"
                          >
                            {cancelBusy && (
                              <span
                                className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent"
                                aria-hidden="true"
                              />
                            )}
                            {t.reservations.yesCancel}
                          </button>
                          <button
                            onClick={() => setCancelling(null)}
                            disabled={cancelBusy}
                            className="border border-paper/30 px-4 py-2 text-xs tracking-[0.2em] text-paper disabled:opacity-40"
                          >
                            {t.reservations.keep}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCancelling(r.id)}
                        className="text-xs tracking-[0.2em] text-paper-faint underline-offset-4 transition-colors hover:text-copper-bright hover:underline"
                      >
                        {t.reservations.cancel}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
