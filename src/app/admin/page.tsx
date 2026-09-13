"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
type Payload = { reservations: AdminReservation[]; externalBlocks: ExternalBlock[]; icalConfigured?: boolean };
type SyncResult = { source: string; events: number; error?: string };

type Screen = "loading" | "forbidden" | "ready";

export default function AdminPage() {
  const { t, lang } = useLang();
  const { enabled, user, loading, signOut } = useAuth();
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("loading");
  const [data, setData] = useState<Payload | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [status, setStatus] = useState<"all" | "confirmed" | "pending" | "cancelled">("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // Which phase the initial load is in, for the loading screen's text.
  const [loadingStep, setLoadingStep] = useState<"auth" | "data">("auth");

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const session = (await getSupabase()?.auth.getSession())?.data.session;
    if (!session) return null;
    return fetch(path, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${session.access_token}` },
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoadingStep("data");
    const res = await authedFetch("/api/admin/reservations");
    if (!res) {
      router.replace("/login?next=/admin");
      return false;
    }
    if (!res.ok) {
      setScreen("forbidden");
      return false;
    }
    setData((await res.json()) as Payload);
    setScreen("ready");
    return true;
  }, [authedFetch, router]);

  async function runSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await authedFetch("/api/admin/sync", { method: "POST" });
      const json = (await res?.json().catch(() => ({}))) as {
        configured?: boolean;
        synced?: SyncResult[];
      };
      if (!res || !res.ok || json.configured === false) {
        setSyncMsg(
          json.configured === false
            ? { tone: "error", text: t.admin.syncNotConnected }
            : { tone: "error", text: t.admin.syncError },
        );
        return;
      }
      const total = (json.synced ?? []).reduce((n, r) => n + (r.error ? 0 : r.events), 0);
      const summary = (json.synced ?? [])
        .map((r) => `${r.source}: ${r.error ? "—" : r.events}`)
        .join(" · ");
      setSyncMsg({ tone: "ok", text: total > 0 ? fill(t.admin.syncDone, { summary }) : t.admin.syncNone });
      await loadData(); // reflect freshly-synced blocks on the calendar
    } catch {
      setSyncMsg({ tone: "error", text: t.admin.syncError });
    } finally {
      setSyncing(false);
    }
  }

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
      if (!cancelled) await loadData();
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, enabled, user, router, loadData]);

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
    const step = loading ? "auth" : loadingStep;
    return (
      <div className="mx-auto flex min-h-[70svh] max-w-5xl flex-col items-center justify-center gap-6 px-5 md:px-8">
        <span
          className="h-9 w-9 animate-spin rounded-full border-2 border-paper/25 border-t-copper"
          aria-hidden="true"
        />
        <div className="text-center" role="status" aria-live="polite">
          <p className="font-display text-lg tracking-[0.15em] text-paper">
            {step === "auth" ? t.admin.loadingAuth : t.admin.loadingData}
          </p>
          {/* Two-dot progress hint of the sequence */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${step === "auth" ? "bg-copper" : "bg-moss"}`} />
            <span className={`h-1.5 w-1.5 rounded-full ${step === "data" ? "bg-copper" : "bg-paper/25"}`} />
          </div>
        </div>
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
        <div className="mt-8">
          {/* Refresh Airbnb / Booking.com feeds on demand (admin-gated route,
              not the cron secret). Only shown when feeds are connected. */}
          {data?.icalConfigured && (
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={runSync}
                disabled={syncing}
                className="flex items-center gap-2.5 border border-paper/30 px-5 py-2.5 text-xs tracking-[0.2em] text-paper-dim transition-all hover:border-copper hover:text-copper-bright disabled:pointer-events-none disabled:opacity-60"
              >
                {syncing && (
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent"
                    aria-hidden="true"
                  />
                )}
                {(syncing ? t.admin.syncing : t.admin.syncNow).toUpperCase()}
              </button>
              {syncMsg && (
                <span className={`text-sm ${syncMsg.tone === "ok" ? "text-moss" : "text-copper-bright"}`}>
                  {syncMsg.text}
                </span>
              )}
            </div>
          )}
          <div className="mt-8">
            <OccupancyCalendar reservations={reservations} externalBlocks={data?.externalBlocks ?? []} />
          </div>
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
