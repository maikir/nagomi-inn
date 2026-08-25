"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { toISODate, nightsOf, todayISO } from "@/lib/reservations/dates";

type Reservation = { checkIn: string; checkOut: string; status: string; name: string };
type ExternalBlock = { checkIn: string; checkOut: string; source: string; summary?: string };
type Occ = { type: "confirmed" | "pending" | "external"; label: string };

const WEEKDAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

/** Read-only month calendar of occupied nights (direct bookings + OTA blocks). */
export function OccupancyCalendar({
  reservations,
  externalBlocks,
}: {
  reservations: Reservation[];
  externalBlocks: ExternalBlock[];
}) {
  const { lang, t } = useLang();
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  // One occupant per night (whole-property). Confirmed outranks pending outranks OTA.
  const occ = useMemo(() => {
    const map = new Map<string, Occ>();
    const rank = { external: 0, pending: 1, confirmed: 2 } as const;
    const place = (night: string, next: Occ) => {
      const cur = map.get(night);
      if (!cur || rank[next.type] > rank[cur.type]) map.set(night, next);
    };
    for (const r of reservations) {
      if (r.status !== "confirmed" && r.status !== "pending") continue;
      const type = r.status === "confirmed" ? "confirmed" : "pending";
      for (const night of nightsOf(r.checkIn, r.checkOut)) place(night, { type, label: r.name });
    }
    for (const b of externalBlocks) {
      for (const night of nightsOf(b.checkIn, b.checkOut))
        place(night, { type: "external", label: b.summary || b.source });
    }
    return map;
  }, [reservations, externalBlocks]);

  const weekdays = lang === "ja" ? WEEKDAYS_JA : WEEKDAYS_EN;
  const today = todayISO();
  const label = cursor.toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "long",
  });
  const firstWeekday = cursor.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();

  const cellClass = (o: Occ | undefined) => {
    if (!o) return "border-paper/10";
    if (o.type === "confirmed") return "border-moss/40 bg-moss/25";
    if (o.type === "pending") return "border-copper/40 bg-copper/20";
    return "border-paper/20 bg-paper/10";
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="p-2 text-paper-dim transition-colors hover:text-paper"
          aria-label="Previous month"
        >
          ←
        </button>
        <p className="font-display text-lg tracking-[0.15em]">{label}</p>
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="p-2 text-paper-dim transition-colors hover:text-paper"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekdays.map((d, i) => (
          <span key={i} className="pb-1 text-center text-[10px] tracking-widest text-paper-faint">
            {d}
          </span>
        ))}
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const iso = toISODate(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1));
          const o = occ.get(iso);
          const isToday = iso === today;
          return (
            <div
              key={iso}
              title={o ? o.label : undefined}
              className={`min-h-[62px] border p-1.5 text-left ${cellClass(o)} ${isToday ? "ring-1 ring-copper" : ""}`}
            >
              <span className={`text-xs ${o ? "text-paper" : "text-paper-faint"}`}>{i + 1}</span>
              {o && (
                <span className="mt-1 block truncate text-[10px] leading-tight text-paper-dim">{o.label}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-paper/10 pt-5 text-xs text-paper-dim">
        <Key className="border-moss/40 bg-moss/25" label={t.admin.legendConfirmed} />
        <Key className="border-copper/40 bg-copper/20" label={t.admin.legendPending} />
        <Key className="border-paper/20 bg-paper/10" label={t.admin.legendExternal} />
        <Key className="border-paper/10" label={t.admin.legendFree} />
      </div>
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`h-4 w-4 border ${className}`} />
      {label}
    </span>
  );
}
