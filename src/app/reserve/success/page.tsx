"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLang, fill } from "@/lib/i18n/LanguageProvider";
import { formatYen } from "@/config/site";
import { LogoMark } from "@/components/LogoMark";
import { getReservationStore, formatDate, type Reservation } from "@/lib/reservations";

/**
 * Landing page after Stripe Checkout. The webhook usually confirms the
 * reservation within a second or two — we poll until it flips from
 * 'pending' to 'confirmed'.
 */

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessInner />
    </Suspense>
  );
}

function SuccessInner() {
  const { t, lang } = useLang();
  const params = useSearchParams();
  const rid = params.get("rid");
  const store = useMemo(() => getReservationStore(), []);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // Payment happened — the draft has served its purpose.
  useEffect(() => {
    try {
      window.sessionStorage.removeItem("nagomi.reserveDraft");
    } catch {}
  }, []);

  useEffect(() => {
    if (!rid) return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const r = await store.get(rid);
        if (cancelled) return;
        if (r) setReservation(r);
        if (r?.status === "confirmed") return;
      } catch {}
      if (attempts >= 30) {
        if (!cancelled) setTimedOut(true);
        return;
      }
      setTimeout(poll, 2000);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [rid, store]);

  const confirmed = reservation?.status === "confirmed";

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 pt-36 text-center md:px-0">
      <div className="flex justify-center">
        <LogoMark size="lg" />
      </div>

      {confirmed ? (
        <>
          <h1 className="mt-8 font-display text-4xl md:text-5xl">{t.reserve.confirmedTitle}</h1>
          <p className="mt-4 text-xs tracking-[0.25em] text-paper-faint">
            {t.reserve.confirmationId.toUpperCase()}: <span className="text-copper-bright">{reservation.id}</span>
          </p>
          <dl className="mt-10 divide-y divide-paper/10 border-y border-paper/10 text-left">
            <Row label={t.reserve.checkIn} value={formatDate(reservation.checkIn, lang)} />
            <Row label={t.reserve.checkOut} value={formatDate(reservation.checkOut, lang)} />
            <Row
              label={t.reserve.guests}
              value={fill(reservation.guests === 1 ? t.reserve.guest_one : t.reserve.guest_other, {
                n: reservation.guests,
              })}
            />
            <Row label={t.reserve.total} value={formatYen(reservation.totalYen)} strong />
          </dl>
        </>
      ) : (
        <>
          <h1 className="mt-8 font-display text-3xl md:text-4xl">{t.reserve.successConfirming}</h1>
          <p className="mt-5 text-sm leading-relaxed text-paper-dim">
            {timedOut ? t.reserve.successSlow : t.reserve.successConfirmingBody}
          </p>
          {!timedOut && (
            <div className="mx-auto mt-10 h-px w-24 animate-pulse bg-copper" aria-hidden="true" />
          )}
        </>
      )}

      <div className="mt-12 flex flex-wrap justify-center gap-4">
        <Link
          href="/reservations"
          className="border border-copper px-8 py-4 text-xs tracking-[0.25em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950"
        >
          {t.reserve.viewReservations.toUpperCase()}
        </Link>
        <Link
          href="/"
          className="border border-paper/30 px-8 py-4 text-xs tracking-[0.25em] text-paper transition-all hover:border-paper"
        >
          {t.reserve.backHome.toUpperCase()}
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(110px,1fr)_2fr] gap-4 py-4">
      <dt className="text-xs tracking-[0.15em] text-paper-faint">{label.toUpperCase()}</dt>
      <dd className={strong ? "font-display text-lg text-copper-bright" : "text-sm text-paper"}>{value}</dd>
    </div>
  );
}
