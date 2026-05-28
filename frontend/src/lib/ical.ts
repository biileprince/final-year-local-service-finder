import type { Booking } from "@/types";

// Browser-side single-booking .ics generation. Mirrors the backend builder
// (backend/src/modules/calendar/ical.util.ts). Booking times are wall-clock in
// Ghana (UTC+0), so we emit them directly as UTC.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function fmtDateTime(d: Date): string {
  return `${fmtDate(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsStatus(status: string): string {
  if (status === "PENDING") return "TENTATIVE";
  if (status === "CANCELLED" || status === "NO_SHOW") return "CANCELLED";
  return "CONFIRMED";
}

export function bookingToIcs(booking: Booking, counterpartName: string): string {
  const date = new Date(booking.scheduledDate);
  const timeStr = booking.scheduledStartTime
    ? new Date(booking.scheduledStartTime).toISOString().slice(11, 19)
    : null;
  const flexible = !timeStr || timeStr === "00:00:00";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Local Service Finder//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${booking.id}@localservicefinder`,
    `DTSTAMP:${fmtDateTime(new Date())}`,
  ];

  if (flexible) {
    const dayAfter = new Date(date);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${fmtDate(date)}`);
    lines.push(`DTEND;VALUE=DATE:${fmtDate(dayAfter)}`);
  } else {
    const [h, m, s] = timeStr!.split(":").map(Number);
    const start = new Date(date);
    start.setUTCHours(h ?? 0, m ?? 0, s ?? 0, 0);
    const end = booking.scheduledEndTime
      ? (() => {
          const [eh, em, es] = new Date(booking.scheduledEndTime!)
            .toISOString()
            .slice(11, 19)
            .split(":")
            .map(Number);
          const e = new Date(date);
          e.setUTCHours(eh ?? 0, em ?? 0, es ?? 0, 0);
          return e;
        })()
      : new Date(start.getTime() + 60 * 60 * 1000);
    lines.push(`DTSTART:${fmtDateTime(start)}`);
    lines.push(`DTEND:${fmtDateTime(end)}`);
  }

  lines.push(`SUMMARY:${escapeText(`Service booking with ${counterpartName}`)}`);
  lines.push(
    `DESCRIPTION:${escapeText(`${booking.problemDescription}\nBooking #${booking.bookingNumber}`)}`,
  );
  lines.push(`LOCATION:${escapeText(booking.serviceAddress)}`);
  lines.push(`STATUS:${icsStatus(booking.status)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.join("\r\n") + "\r\n";
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
