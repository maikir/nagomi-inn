"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { addDays, toISODate, todayISO } from "@/lib/reservations/dates";

const WEEKDAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

type Props = {
  checkIn: string | null;
  checkOut: string | null;
  booked: Set<string>;
  onChange: (checkIn: string | null, checkOut: string | null) => void;
};

/**
 * Two-month date-range picker.
 * First click sets check-in, second sets check-out. Booked or past dates are
 * disabled; a range can't span a booked night.
 */
export function RangeCalendar({ checkIn, checkOut, booked, onChange }: Props) {
  const { lang, t } = useLang();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [hovered, setHovered] = useState<string | null>(null);

  const today = todayISO();

  function isDisabled(iso: string): boolean {
    if (iso < today) return true;
    if (booked.has(iso)) {
      // A booked night can't be a check-in; it can still be a check-out
      // (departure morning) if it's the day right after the selected check-in.
      if (checkIn && !checkOut && iso > checkIn) return !rangeIsFree(checkIn, iso);
      return true;
    }
    return false;
  }

  function rangeIsFree(from: string, to: string): boolean {
    let cur = from;
    while (cur < to) {
      if (booked.has(cur)) return false;
      cur = addDays(cur, 1);
    }
    return true;
  }

  function handleClick(iso: string) {
    if (!checkIn || (checkIn && checkOut)) {
      // start a fresh selection
      if (booked.has(iso) || iso < today) return;
      onChange(iso, null);
    } else {
      // picking the check-out
      if (iso <= checkIn) {
        if (booked.has(iso)) return;
        onChange(iso, null);
        return;
      }
      if (!rangeIsFree(checkIn, iso)) return;
      onChange(checkIn, iso);
    }
  }

  const inRange = (iso: string) => {
    const end = checkOut ?? (hovered && checkIn && hovered > checkIn && rangeIsFree(checkIn, hovered) ? hovered : null);
    return checkIn && end ? iso >= checkIn && iso <= end : false;
  };

  const months = [0, 1].map((offset) => new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1));
  const weekdays = lang === "ja" ? WEEKDAYS_JA : WEEKDAYS_EN;

  const canGoBack =
    cursor.getFullYear() > new Date().getFullYear() ||
    (cursor.getFullYear() === new Date().getFullYear() && cursor.getMonth() > new Date().getMonth());

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => canGoBack && setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          disabled={!canGoBack}
          className="p-2 text-paper-dim transition-colors hover:text-paper disabled:opacity-20"
          aria-label="Previous month"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="p-2 text-paper-dim transition-colors hover:text-paper"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="grid gap-10 sm:grid-cols-2">
        {months.map((month) => {
          const label = month.toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US", {
            year: "numeric",
            month: "long",
          });
          const firstWeekday = month.getDay();
          const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

          return (
            <div key={label}>
              <p className="mb-4 text-center font-display text-sm tracking-[0.2em]">{label}</p>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {weekdays.map((d, i) => (
                  <span key={i} className="pb-2 text-[10px] tracking-widest text-paper-faint">
                    {d}
                  </span>
                ))}
                {Array.from({ length: firstWeekday }).map((_, i) => (
                  <span key={`pad-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const iso = toISODate(new Date(month.getFullYear(), month.getMonth(), i + 1));
                  const disabled = isDisabled(iso);
                  const isBooked = booked.has(iso) && iso >= today;
                  const isStart = iso === checkIn;
                  const isEnd = iso === checkOut;
                  const selected = isStart || isEnd;
                  const within = inRange(iso);

                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={disabled && !selected}
                      onClick={() => handleClick(iso)}
                      onMouseEnter={() => setHovered(iso)}
                      onMouseLeave={() => setHovered(null)}
                      className={[
                        "relative mx-auto grid h-10 w-10 place-items-center text-sm transition-colors",
                        // Booked night: filled/blacked-out cell, struck through
                        isBooked && !selected
                          ? "cursor-not-allowed bg-paper/15 text-paper-faint line-through decoration-paper-faint"
                          : "",
                        // Past date: simply faded
                        disabled && !isBooked && !selected ? "cursor-not-allowed text-paper-faint/40" : "",
                        selected ? "bg-copper text-sumi-950 font-medium" : "",
                        !selected && within ? "bg-copper/20 text-paper" : "",
                        !selected && !within && !disabled ? "text-paper-dim hover:bg-paper/10 hover:text-paper" : "",
                      ].join(" ")}
                      aria-pressed={selected}
                      aria-label={iso}
                      aria-disabled={disabled && !selected}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Color key */}
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-paper/10 pt-5 text-xs text-paper-dim">
        <span className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center border border-paper/20 text-[11px] text-paper-dim">1</span>
          {t.reserve.legendOpen}
        </span>
        <span className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center bg-paper/15 text-[11px] text-paper-faint line-through decoration-paper-faint">
            1
          </span>
          {t.reserve.legendTaken}
        </span>
        <span className="flex items-center gap-2.5">
          <span className="grid h-6 w-6 place-items-center bg-copper text-[11px] font-medium text-sumi-950">1</span>
          {t.reserve.legendSelected}
        </span>
      </div>
    </div>
  );
}
