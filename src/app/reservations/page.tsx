"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLang, fill } from "@/lib/i18n/LanguageProvider";
import { formatYen } from "@/config/site";
import { getReservationStore, formatDate, nightsBetween, type Reservation } from "@/lib/reservations";

export default function ReservationsPage() {
  const { t, lang } = useLang();
  const store = useMemo(() => getReservationStore(), []);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    store.list().then(setReservations);
  }, [store]);

  async function confirmCancel(id: string) {
    await store.cancel(id);
    setReservations(await store.list());
    setCancelling(null);
  }

  return (
    <div className="mx-auto max-w-4xl px-5 pb-28 pt-28 md:px-8 md:pt-36">
      <p className="text-[11px] tracking-[0.35em] text-copper-bright">田舎民泊 和</p>
      <h1 className="mt-4 font-display text-4xl md:text-5xl">{t.reservations.title}</h1>
      <p className="mt-4 text-paper-dim">{t.reservations.subtitle}</p>

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
            return (
              <li
                key={r.id}
                className={`border bg-sumi-900 p-6 md:p-8 ${cancelled ? "border-paper/10 opacity-50" : "border-paper/15"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-[0.25em] text-paper-faint">
                      {r.id} ・{" "}
                      <span className={cancelled ? "text-paper-faint" : "text-moss"}>
                        {cancelled ? t.reservations.status.cancelled : t.reservations.status.confirmed}
                      </span>
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

                {!cancelled && (
                  <div className="mt-6 border-t border-paper/10 pt-5">
                    {cancelling === r.id ? (
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="text-sm text-copper-bright">{t.reservations.cancelConfirm}</span>
                        <button
                          onClick={() => confirmCancel(r.id)}
                          className="border border-copper px-4 py-2 text-xs tracking-[0.2em] text-copper-bright transition-all hover:bg-copper hover:text-sumi-950"
                        >
                          {t.reservations.yesCancel}
                        </button>
                        <button
                          onClick={() => setCancelling(null)}
                          className="border border-paper/30 px-4 py-2 text-xs tracking-[0.2em] text-paper"
                        >
                          {t.reservations.keep}
                        </button>
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
