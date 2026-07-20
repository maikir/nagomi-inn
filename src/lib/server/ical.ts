/**
 * Minimal iCal (.ics) helpers — server-side only.
 * OTA availability feeds (Airbnb / Booking.com) are flat lists of all-day
 * VEVENTs, so a tiny purpose-built parser beats a dependency here.
 */

export type IcalEvent = {
  uid: string;
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD, exclusive (iCal all-day DTEND semantics = our check_out) */
  end: string;
  summary?: string;
};

/** Unfold RFC 5545 folded lines (CRLF followed by space/tab). */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .split(/\r?\n/);
}

/** "20260810" | "20260810T150000Z" → "2026-08-10" */
function toDate(value: string): string | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function addDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + 1));
  return date.toISOString().slice(0, 10);
}

export function parseIcs(text: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  let cur: Partial<IcalEvent> | null = null;

  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur?.uid && cur.start) {
        // Missing/equal DTEND on an all-day event means a single night.
        const end = cur.end && cur.end > cur.start ? cur.end : addDay(cur.start);
        events.push({ uid: cur.uid, start: cur.start, end, summary: cur.summary });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).split(";")[0].toUpperCase();
    const value = line.slice(idx + 1).trim();

    if (key === "UID") cur.uid = value;
    else if (key === "SUMMARY") cur.summary = value;
    else if (key === "DTSTART") cur.start = toDate(value) ?? cur.start;
    else if (key === "DTEND") cur.end = toDate(value) ?? cur.end;
  }
  return events;
}

/** Escape a text value per RFC 5545. */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(
  events: { uid: string; start: string; end: string; summary: string }[],
  calendarName: string,
): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nagomi Inn Miyazaki//Availability//EN",
    `X-WR-CALNAME:${esc(calendarName)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${esc(e.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${e.start.replace(/-/g, "")}`,
      `DTEND;VALUE=DATE:${e.end.replace(/-/g, "")}`,
      `SUMMARY:${esc(e.summary)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
