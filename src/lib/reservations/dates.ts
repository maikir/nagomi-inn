/** Date helpers — all work on YYYY-MM-DD strings in local time. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = fromISODate(checkOut).getTime() - fromISODate(checkIn).getTime();
  return Math.round(ms / 86_400_000);
}

/** Every night occupied by a stay: [checkIn, checkOut) */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  let cur = checkIn;
  while (cur < checkOut) {
    nights.push(cur);
    cur = addDays(cur, 1);
  }
  return nights;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function formatDate(iso: string, lang: "en" | "ja"): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString(lang === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: lang === "ja" ? "long" : "short",
    day: "numeric",
    weekday: "short",
  });
}
