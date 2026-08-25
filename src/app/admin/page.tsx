"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang, fill } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase/client";
import { formatYen } from "@/config/site";
import { formatDate, nightsBetween, nightsOf, todayISO } from "@/lib/reservations";
import { OccupancyCalendar } from "@/components/admin/OccupancyCalendar";

type AdminReservation = {
  id: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  totalYen: number;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  paidAt?: string;
};
type ExternalBlock = { source: string; checkIn: string; checkOut: string; summary?: string };
type Payload = { reservations: AdminReservation[]; externalBlocks: ExternalBlock[] };

type Screen = "loading" | "forbidden" | "ready";

export default function AdminPage() {
  const { t, lang } = useLang();
  const { enabled, user, loading, signOut } = useAuth();
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("loading");
  const [data, setData] = useState<Payload | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [status, setStatus] = useState<"all" | "confirmed" | "pending" | "cancelled">("all");

  useEffect(() => {
    if (loading) return;
    if (!enabled) {
      setScreen("forbidden");
      return;
    }
    if (!user) {
      router.replace("/login?next=/admin");
      return;
    }
    let cancelled = false;
    (async () => {
      const session = (await getSupabase()?.auth.getSession())?.data.session;
      if (!session) {
        router.replace("/login?next=/admin");
        return;
      }
      const res = await fetch("/api/admin/reservations", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (cancelled) return;
      if (!res.ok) {
        setScreen("forbidden");
        return;
      }
      setData((await res.json()) as Payload);
      setScreen("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, enabled, user, router]);

  const today = todayISO();

  const stats = useMemo(() => {
    if (!data) return { upcoming: 0, nightsThisMonth: 0, next: null as AdminReservation | null };
    const active = data.reservations.filter((r) => r.status === "confirmed" || r.status === "pending");
    const upcoming = active.filter((r) => r.checkOut > today);
    const next = upcoming
      .filter((r) => r.checkIn >= today)
      .sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1))[0] ?? null;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let nightsThisMonth = 0;
    for (const r of active) {
      for (const night of nightsOf(r.checkIn, r.checkOut)) if (night.startsWith(ym)) nightsThisMonth++;
    }
    return { upcoming: upcoming.length, nightsThisMonth, next };
  }, [data, today]);

  if (screen === "loading") {
    return (
      <div className="mx-auto max-w-5xl px-5 pt-32 md:px-8">
        <div className="h-40 animate-pulse border border-paper/10 bg-sumi-900" />
      </div>
    );
  }

  if (screen === "forbidden") {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-28 pt-32 text-center md:px-8">
        <h1 className="font-display text-3xl md:text-4xl">{t.admin.title}</h1>
        <p className="mt-6 border border-paper/15 bg-sumi-900 px-6 py-8 text-sm text-paper-dim">
          {t.admin.notAuthorized}
        </p>
        <Link
          href="/"
          className="mt-8 inline-block border border-paper/30 px-8 py-4 text-xs tracking-[0.25em] text-paper transition-all hover:border-paper"
        >
          {t.admin.backHome.toUpperCase()}
        </Link>
      </div>
    );
  }

  const reservations = data?.reservations ?? [];
  const filtered = status === "all" ? reservations : reservations.filter((r) => r.status === status);
  const upcoming = filtered.filter((r) => r.checkOut > today);
  const past = filtered.filter((r) => r.checkOut <= today).reverse();

  const filters: { key: typeof status; label: string }[] = [
    { key: "all", label: t.admin.filterAll },
    { key: "confirmed", label: t.admin.status.confirmed },
    { key: "pending", label: t.admin.status.pending },
    { key: "cancelled", label: t.admin.status.cancelled },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-28 md:px-8 md:pt-36">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.35em] text-copper-bright">田舎民泊 和</p>
          <h1 className="mt-3 font-display text-4xl md:text-5xl">{t.admin.title}</h1>
          <p className="mt-3 text-paper-dim">{t.admin.subtitle}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-xs tracking-[0.2em] text-paper-faint underline-offset-4 transition-colors hover:text-copper-bright hover:underline"
        >
          {t.admin.signOut}
        </button>
      </div>

      {/* Stat tiles */}
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label={t.admin.statUpcoming} value={String(stats.upcoming)} />
        <Stat label={t.admin.statNights} value={String(stats.nightsThisMonth)} />
        <Stat
          label={t.admin.statNext}
          value={stats.next ? formatDate(stats.next.checkIn, lang) : t.admin.statNextNone}
          sub={stats.next?.name}
        />
      </div>

      {/* View toggle */}
      <div className="mt-12 flex gap-2 border-b border-paper/10">
        {(["list", "calendar"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`-mb-px border-b-2 px-4 py-3 text-xs tracking-[0.2em] transition-colors ${
              view === v ? "border-copper text-copper-bright" : "border-transparent text-paper-faint hover:text-paper-dim"
            }`}
          >
            {(v === "list" ? t.admin.tabList : t.admin.tabCalendar).toUpperCase()}
          </button>
        ))}
      </div>

      {view === "calendar" ? (
        <div className="mt-10">
          <OccupancyCalendar reservations={reservations} externalBlocks={data?.externalBlocks ?? []} />
        </div>
      ) : (
        <div className="mt-8">
          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatus(f.key)}
                className={`border px-4 py-2 text-xs tracking-[0.15em] transition-all ${
                  status === f.key
                    ? "border-copper text-copper-bright"
                    : "border-paper/20 text-paper-faint hover:border-paper/40 hover:text-paper-dim"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <Section title={t.admin.upcoming} rows={upcoming} today={today} />
          <Section title={t.admin.past} rows={past} today={today} muted />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-paper/15 bg-sumi-900 p-6">
      <p className="text-[10px] tracking-[0.2em] text-paper-faint">{label.toUpperCase()}</p>
      <p className="mt-3 font-display text-2xl text-paper">{value}</p>
      {sub && <p className="mt-1 truncate text-sm text-paper-dim">{sub}</p>}
    </div>
  );
}

function Section({
  title,
  rows,
  muted,
}: {
  title: string;
  rows: AdminReservation[];
  today: string;
  muted?: boolean;
}) {
  const { t, lang } = useLang();
  return (
    <div className="mt-10">
      <h2 className="text-xs tracking-[0.3em] text-paper-faint">{title.toUpperCase()}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-paper-faint">{t.admin.none}</p>
      ) : (
        <ul className={`mt-4 space-y-3 ${muted ? "opacity-70" : ""}`}>
          {rows.map((r) => {
            const nights = nightsBetween(r.checkIn, r.checkOut);
            const pill =
              r.status === "confirmed"
                ? "border-moss/50 bg-moss/15 text-moss"
                : r.status === "pending"
                  ? "border-copper/50 bg-copper/15 text-copper-bright"
                  : "border-paper/20 bg-paper/5 text-paper-faint line-through";
            return (
              <li key={r.id} className="border border-paper/15 bg-sumi-900 p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`border px-2.5 py-1 text-[10px] tracking-[0.15em] ${pill}`}>
                        {t.admin.status[r.status]}
                      </span>
                      <span className="text-xs tracking-[0.2em] text-paper-faint">{r.id}</span>
                    </div>
                    <p className="mt-3 font-display text-lg md:text-xl">
                      {formatDate(r.checkIn, lang)} → {formatDate(r.checkOut, lang)}
                    </p>
                    <p className="mt-1.5 text-sm text-paper-dim">
                      {fill(nights === 1 ? t.admin.nights_one : t.admin.nights_other, { n: nights })} ・{" "}
                      {fill(r.guests === 1 ? t.admin.guests_one : t.admin.guests_other, { n: r.guests })}
                    </p>
                    <p className="mt-2 text-sm text-paper">{r.name}</p>
                    <p className="text-xs text-paper-faint">
                      <a href={`mailto:${r.email}`} className="transition-colors hover:text-paper-dim">
                        {r.email}
                      </a>
                      {r.phone && (
                        <>
                          {" ・ "}
                          <a href={`tel:${r.phone.replace(/[^+\d]/g, "")}`} className="transition-colors hover:text-paper-dim">
                            {r.phone}
                          </a>
                        </>
                      )}
                    </p>
                    {r.notes && <p className="mt-2 text-sm text-paper-dim">“{r.notes}”</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl text-copper-bright">{formatYen(r.totalYen)}</p>
                    <p className="mt-1 text-[10px] tracking-[0.15em] text-paper-faint">
                      {t.admin.bookedOn.toUpperCase()} {formatDate(r.createdAt.slice(0, 10), lang)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
