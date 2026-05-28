import type { Booking } from "@/types";
import { formatDate, formatTime } from "@/lib/utils";

type ViewerRole = "PROVIDER" | "CUSTOMER" | string | undefined;

function counterpart(b: Booking, role: ViewerRole): string {
  return role === "PROVIDER"
    ? (b.customer?.name ?? "")
    : (b.provider?.user?.name ?? "");
}

function timeLabel(b: Booking): string {
  if (!b.scheduledStartTime) return "Flexible";
  const t = new Date(b.scheduledStartTime).toISOString().slice(11, 19);
  return t === "00:00:00" ? "Flexible" : formatTime(b.scheduledStartTime);
}

const COLUMNS = [
  "Booking #",
  "Date",
  "Time",
  "Status",
  "With",
  "Address",
  "Estimated",
  "Final",
  "Payment",
] as const;

function rowFor(b: Booking, role: ViewerRole): string[] {
  return [
    b.bookingNumber,
    formatDate(b.scheduledDate),
    timeLabel(b),
    b.status,
    counterpart(b, role),
    b.serviceAddress,
    b.estimatedAmount != null ? String(b.estimatedAmount) : "",
    b.finalAmount != null ? String(b.finalAmount) : "",
    b.paymentStatus,
  ];
}

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export function bookingsToCsv(bookings: Booking[], role: ViewerRole): string {
  const lines = [
    COLUMNS.map(csvCell).join(","),
    ...bookings.map((b) => rowFor(b, role).map(csvCell).join(",")),
  ];
  return lines.join("\r\n");
}

export function downloadText(
  filename: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Open a clean printable document of the booking history and trigger print. */
export function printBookings(bookings: Booking[], role: ViewerRole): void {
  const head = COLUMNS.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
  const body = bookings
    .map(
      (b) =>
        `<tr>${rowFor(b, role)
          .map((c) => `<td>${escapeHtml(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8" />
<title>Booking history</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  p { color: #555; margin-top: 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; }
</style></head>
<body>
  <h1>Booking history</h1>
  <p>${bookings.length} booking(s) · generated ${escapeHtml(formatDate(new Date().toISOString()))}</p>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
