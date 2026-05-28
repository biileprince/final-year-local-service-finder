// Minimal RFC 5545 iCalendar builder for booking events. Ghana runs on UTC+0
// year-round, and booking times are stored as wall-clock times, so we emit
// times directly as UTC (…Z) without timezone conversion.

export interface IcalEvent {
  id: string;
  bookingNumber: string;
  scheduledDate: Date;
  scheduledStartTime: Date | null;
  scheduledEndTime: Date | null;
  status: string;
  summary: string;
  description: string;
  location: string;
}

const FLEXIBLE_TIME = "00:00:00";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toIcsDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function toIcsDateTime(d: Date): string {
  return `${toIcsDate(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Escape text per RFC 5545 (backslash, comma, semicolon, newline). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets per RFC 5545 (continuation = CRLF + space). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

/** Combine a date-only value with a time-only value into a UTC datetime. */
function combine(dateOnly: Date, time: Date | null): Date | null {
  if (!time) return null;
  const t = time.toISOString().slice(11, 19);
  if (t === FLEXIBLE_TIME) return null;
  const d = new Date(dateOnly);
  const [h, m, s] = t.split(":").map(Number);
  d.setUTCHours(h, m, s ?? 0, 0);
  return d;
}

function icsStatus(status: string): string {
  switch (status) {
    case "PENDING":
      return "TENTATIVE";
    case "CANCELLED":
    case "NO_SHOW":
      return "CANCELLED";
    default:
      return "CONFIRMED";
  }
}

function buildEvent(event: IcalEvent, stamp: Date): string[] {
  const start = combine(event.scheduledDate, event.scheduledStartTime);
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${event.id}@localservicefinder`);
  lines.push(`DTSTAMP:${toIcsDateTime(stamp)}`);

  if (start) {
    const end =
      combine(event.scheduledDate, event.scheduledEndTime) ??
      new Date(start.getTime() + 60 * 60 * 1000);
    lines.push(`DTSTART:${toIcsDateTime(start)}`);
    lines.push(`DTEND:${toIcsDateTime(end)}`);
  } else {
    // Flexible-time → all-day event.
    const dayAfter = new Date(event.scheduledDate);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(event.scheduledDate)}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(dayAfter)}`);
  }

  lines.push(`SUMMARY:${escapeText(event.summary)}`);
  lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  lines.push(`LOCATION:${escapeText(event.location)}`);
  lines.push(`STATUS:${icsStatus(event.status)}`);
  lines.push("END:VEVENT");
  return lines;
}

export function buildCalendar(events: IcalEvent[], name = "Bookings"): string {
  const stamp = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Local Service Finder//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
  ];
  for (const event of events) {
    lines.push(...buildEvent(event, stamp));
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
