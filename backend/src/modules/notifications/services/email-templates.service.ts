import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Industry-standard transactional email templates for Local Service Finder.
 *
 * Design constraints (in order of priority):
 *   1. Render correctly in Gmail, Outlook (desktop + web + Windows Mail), Apple
 *      Mail, iOS Mail, Yahoo, and dark-mode clients. We use a table-based
 *      single-column layout, inline CSS, and 600px max width.
 *   2. Pass spam-filter heuristics: a plain-text fallback is always provided,
 *      colors keep WCAG AA contrast, no `<script>` / `<form>` / external CSS.
 *   3. Brand consistency: shared header / footer / button / typography in one
 *      `wrap()` helper so every template is identical down to the pixel.
 *   4. Each template returns `{ subject, html, text }` so the caller never
 *      has to know the design.
 */
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface BrandTokens {
  brandName: string;
  brandColor: string; // CTA + accent
  textColor: string;
  mutedColor: string;
  bgColor: string;
  cardBgColor: string;
  borderColor: string;
  frontendUrl: string;
  supportEmail: string;
}

@Injectable()
export class EmailTemplatesService {
  private readonly brand: BrandTokens;

  constructor(private readonly configService: ConfigService) {
    this.brand = {
      brandName:
        this.configService.get<string>("EMAIL_FROM_NAME") ??
        "Local Service Finder",
      brandColor: "#4F46E5",
      textColor: "#1F2937",
      mutedColor: "#6B7280",
      bgColor: "#F3F4F6",
      cardBgColor: "#FFFFFF",
      borderColor: "#E5E7EB",
      frontendUrl:
        this.configService.get<string>("FRONTEND_URL") ??
        "http://localhost:3000",
      supportEmail:
        this.configService.get<string>("EMAIL_REPLY_TO") ??
        this.configService.get<string>("EMAIL_FROM") ??
        "support@localservicefinder.com",
    };
  }

  // -- Public template renderers ---------------------------------------------

  welcome(opts: {
    name: string;
    role: "CUSTOMER" | "PROVIDER";
  }): RenderedEmail {
    const isProvider = opts.role === "PROVIDER";
    const subject = `Welcome to ${this.brand.brandName}, ${opts.name.split(" ")[0]}!`;
    const cta = isProvider
      ? {
          label: "Complete your provider profile",
          url: `${this.brand.frontendUrl}/services`,
        }
      : {
          label: "Find a service provider",
          url: `${this.brand.frontendUrl}/search`,
        };
    const intro = isProvider
      ? "You're set up as a service provider. Your account is pending verification — once an admin reviews your documents, you'll appear in search results and can accept bookings."
      : "You're all set to book trusted, verified local service providers — plumbers, electricians, cleaners, and more.";

    const body = `
      <p style="${P}">Hi ${escape(opts.name.split(" ")[0])},</p>
      <p style="${P}">${intro}</p>
      ${this.button(cta.label, cta.url)}
      <p style="${P}">If you have any questions, just reply to this email — we're here to help.</p>
      <p style="${P}">Cheers,<br>The ${this.brand.brandName} team</p>
    `;
    return this.wrap({
      subject,
      preheader: intro,
      title: `Welcome to ${this.brand.brandName} 👋`,
      body,
      textIntro: `Welcome to ${this.brand.brandName}, ${opts.name}!\n\n${intro}\n\nGet started: ${cta.url}`,
    });
  }

  emailVerification(opts: {
    name: string;
    code: string;
    ttlMinutes: number;
  }): RenderedEmail {
    const subject = `Your verification code is ${opts.code}`;
    const codeDisplay = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0">
        <tr>
          <td align="center">
            <div style="display:inline-block;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:bold;letter-spacing:12px;color:${this.brand.textColor};background:${this.brand.bgColor};border:2px dashed ${this.brand.borderColor};border-radius:12px;padding:18px 28px">${escape(opts.code)}</div>
          </td>
        </tr>
      </table>
    `;
    const body = `
      <p style="${P}">Hi ${escape(opts.name.split(" ")[0])},</p>
      <p style="${P}">Use the 6-digit code below to verify your email address. This code expires in <strong>${opts.ttlMinutes} minutes</strong>.</p>
      ${codeDisplay}
      <p style="${SMALL}">Enter the code on the verification screen. If you didn't request this, you can safely ignore the email — no one can access your account without the code.</p>
    `;
    return this.wrap({
      subject,
      preheader: `Your verification code is ${opts.code} — expires in ${opts.ttlMinutes} minutes.`,
      title: "Verify your email",
      body,
      textIntro: `Hi ${opts.name},\n\nYour verification code is: ${opts.code}\n\nIt expires in ${opts.ttlMinutes} minutes. Enter it on the verification screen to finish setting up your account.\n\nIf you didn't request this, ignore the email.`,
    });
  }

  passwordReset(opts: {
    name: string;
    code: string;
    ttlMinutes: number;
  }): RenderedEmail {
    const subject = `Your password reset code is ${opts.code}`;
    const codeDisplay = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0">
        <tr>
          <td align="center">
            <div style="display:inline-block;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:bold;letter-spacing:12px;color:${this.brand.textColor};background:${this.brand.bgColor};border:2px dashed ${this.brand.borderColor};border-radius:12px;padding:18px 28px">${escape(opts.code)}</div>
          </td>
        </tr>
      </table>
    `;
    const body = `
      <p style="${P}">Hi ${escape(opts.name.split(" ")[0])},</p>
      <p style="${P}">We received a request to reset your password. Use the 6-digit code below on the reset screen — it expires in <strong>${opts.ttlMinutes} minutes</strong>.</p>
      ${codeDisplay}
      <p style="${SMALL}">If you didn't request a password reset, your account is still safe — just ignore this email.</p>
    `;
    return this.wrap({
      subject,
      preheader: `Your password reset code is ${opts.code} — expires in ${opts.ttlMinutes} minutes.`,
      title: "Reset your password",
      body,
      textIntro: `Hi ${opts.name},\n\nYour password reset code is: ${opts.code}\n\nIt expires in ${opts.ttlMinutes} minutes. Enter it on the reset screen to choose a new password.\n\nDidn't request this? Ignore the email.`,
    });
  }

  bookingConfirmed(opts: {
    recipientName: string;
    counterpartName: string;
    bookingNumber: string;
    date: string;
    time: string;
    address?: string;
    isProvider: boolean;
  }): RenderedEmail {
    const subject = opts.isProvider
      ? `New booking from ${opts.counterpartName}`
      : `Your booking is confirmed`;
    const intro = opts.isProvider
      ? `${opts.counterpartName} just booked you for the date below. Confirm or decline from your dashboard.`
      : `Great news — ${opts.counterpartName} confirmed your booking.`;
    const ctaLabel = opts.isProvider ? "Open booking" : "View booking";
    const url = `${this.brand.frontendUrl}/bookings`;

    const body = `
      <p style="${P}">Hi ${escape(opts.recipientName.split(" ")[0])},</p>
      <p style="${P}">${intro}</p>
      ${this.detailsTable([
        ["Booking #", opts.bookingNumber],
        ["Date", opts.date],
        ["Time", opts.time],
        ...(opts.address
          ? ([["Address", opts.address]] as [string, string][])
          : []),
        [opts.isProvider ? "Customer" : "Provider", opts.counterpartName],
      ])}
      ${this.button(ctaLabel, url)}
    `;
    return this.wrap({
      subject,
      preheader: `Booking #${opts.bookingNumber} · ${opts.date} ${opts.time}`,
      title: opts.isProvider ? "New booking received" : "Booking confirmed",
      body,
      textIntro: `${intro}\n\nBooking #${opts.bookingNumber}\nDate: ${opts.date}\nTime: ${opts.time}${opts.address ? `\nAddress: ${opts.address}` : ""}\n\n${url}`,
    });
  }

  bookingCancelled(opts: {
    recipientName: string;
    counterpartName: string;
    bookingNumber: string;
    cancelledByLabel: string;
    reason?: string;
  }): RenderedEmail {
    const subject = `Booking #${opts.bookingNumber} cancelled`;
    const body = `
      <p style="${P}">Hi ${escape(opts.recipientName.split(" ")[0])},</p>
      <p style="${P}">Your booking <strong>#${opts.bookingNumber}</strong> with ${escape(opts.counterpartName)} has been cancelled by <strong>${escape(opts.cancelledByLabel)}</strong>.</p>
      ${opts.reason ? `<p style="${P}"><em>Reason:</em> ${escape(opts.reason)}</p>` : ""}
      ${this.button("View booking history", `${this.brand.frontendUrl}/bookings`)}
      <p style="${SMALL}">Need to find someone else? Browse providers anytime.</p>
    `;
    return this.wrap({
      subject,
      preheader: `Cancelled by ${opts.cancelledByLabel}.`,
      title: "Booking cancelled",
      body,
      textIntro: `Booking #${opts.bookingNumber} with ${opts.counterpartName} was cancelled by ${opts.cancelledByLabel}.${opts.reason ? `\n\nReason: ${opts.reason}` : ""}`,
      accent: "#DC2626",
    });
  }

  bookingCompletedReviewPrompt(opts: {
    recipientName: string;
    providerName: string;
    bookingNumber: string;
    bookingId: string;
  }): RenderedEmail {
    const subject = `How was your service with ${opts.providerName}?`;
    const url = `${this.brand.frontendUrl}/bookings/${opts.bookingId}`;
    const body = `
      <p style="${P}">Hi ${escape(opts.recipientName.split(" ")[0])},</p>
      <p style="${P}">Thanks for using ${this.brand.brandName}. Now that ${escape(opts.providerName)} has completed booking <strong>#${opts.bookingNumber}</strong>, would you mind sharing how it went?</p>
      <p style="${P}">Honest reviews help other customers make confident choices and give great providers the recognition they deserve.</p>
      ${this.button("Leave a review", url)}
    `;
    return this.wrap({
      subject,
      preheader: `Help others by reviewing ${opts.providerName}.`,
      title: "Tell us how it went",
      body,
      textIntro: `Thanks for using ${this.brand.brandName}!\n\n${opts.providerName} has completed booking #${opts.bookingNumber}. Leave a review at ${url}`,
      accent: "#10B981",
    });
  }

  newReview(opts: {
    providerName: string;
    customerName: string;
    rating: number;
    bookingNumber: string;
  }): RenderedEmail {
    const subject = `New ${opts.rating}-star review from ${opts.customerName}`;
    const stars = "★".repeat(opts.rating) + "☆".repeat(5 - opts.rating);
    const url = `${this.brand.frontendUrl}/analytics`;
    const body = `
      <p style="${P}">Hi ${escape(opts.providerName.split(" ")[0])},</p>
      <p style="${P}">${escape(opts.customerName)} just left a review for booking <strong>#${opts.bookingNumber}</strong>.</p>
      <p style="font-size:32px;line-height:1;margin:24px 0;color:#F59E0B;letter-spacing:4px">${stars}</p>
      ${this.button("Read review", url)}
      <p style="${SMALL}">You can post one public reply to each review from your dashboard.</p>
    `;
    return this.wrap({
      subject,
      preheader: `${opts.customerName} rated you ${opts.rating}/5.`,
      title: "New review received",
      body,
      textIntro: `${opts.customerName} left you a ${opts.rating}/5 review for booking #${opts.bookingNumber}.\n\nView at ${url}`,
      accent: "#F59E0B",
    });
  }

  providerVerified(opts: { providerName: string }): RenderedEmail {
    const subject = "Your provider account is verified 🎉";
    const url = `${this.brand.frontendUrl}/services`;
    const body = `
      <p style="${P}">Hi ${escape(opts.providerName.split(" ")[0])},</p>
      <p style="${P}">Great news — an admin has reviewed your documents and your provider account is now <strong>verified</strong>.</p>
      <p style="${P}">You're now visible in search results and can start accepting bookings. Customers can see your verified badge on your profile.</p>
      ${this.button("Set up availability", url)}
    `;
    return this.wrap({
      subject,
      preheader: "You can now appear in search and accept bookings.",
      title: "You're verified!",
      body,
      textIntro: `Your provider account at ${this.brand.brandName} is verified. Set up availability at ${url}`,
      accent: "#10B981",
    });
  }

  providerRejected(opts: {
    providerName: string;
    reason?: string;
  }): RenderedEmail {
    const subject = "Verification needs another look";
    const body = `
      <p style="${P}">Hi ${escape(opts.providerName.split(" ")[0])},</p>
      <p style="${P}">An admin has reviewed your documents but wasn't able to verify your account yet.</p>
      ${opts.reason ? `<p style="${P}"><strong>Reason:</strong> ${escape(opts.reason)}</p>` : ""}
      <p style="${P}">No problem — you can update your documents and re-submit from your services page.</p>
      ${this.button("Update documents", `${this.brand.frontendUrl}/services`)}
    `;
    return this.wrap({
      subject,
      preheader: "Update your documents and try again.",
      title: "Verification update",
      body,
      textIntro: `Your verification was not accepted.${opts.reason ? `\n\nReason: ${opts.reason}` : ""}\n\nResubmit at ${this.brand.frontendUrl}/services`,
      accent: "#DC2626",
    });
  }

  bookingReminder(opts: {
    recipientName: string;
    counterpartName: string;
    bookingNumber: string;
    date: string;
    time: string;
    hoursUntil: number;
  }): RenderedEmail {
    const subject = `Reminder: booking with ${opts.counterpartName} in ${opts.hoursUntil}h`;
    const body = `
      <p style="${P}">Hi ${escape(opts.recipientName.split(" ")[0])},</p>
      <p style="${P}">Just a heads-up — booking <strong>#${opts.bookingNumber}</strong> with ${escape(opts.counterpartName)} is coming up in <strong>${opts.hoursUntil} hours</strong>.</p>
      ${this.detailsTable([
        ["Date", opts.date],
        ["Time", opts.time],
      ])}
      ${this.button("Open booking", `${this.brand.frontendUrl}/bookings`)}
    `;
    return this.wrap({
      subject,
      preheader: `${opts.date} at ${opts.time}.`,
      title: "Booking reminder",
      body,
      textIntro: `Reminder: booking #${opts.bookingNumber} with ${opts.counterpartName} on ${opts.date} at ${opts.time}.`,
      accent: "#F59E0B",
    });
  }

  // -- Wrapper / shared chrome ------------------------------------------------

  private wrap(args: {
    subject: string;
    preheader: string;
    title: string;
    body: string;
    textIntro: string;
    accent?: string;
  }): RenderedEmail {
    const accent = args.accent ?? this.brand.brandColor;
    const year = new Date().getFullYear();

    const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escape(args.subject)}</title>
    <!--[if mso]>
    <style type="text/css">table{border-collapse:collapse}td{font-family:Segoe UI,Helvetica,Arial,sans-serif}</style>
    <![endif]-->
  </head>
  <body style="margin:0;padding:0;background:${this.brand.bgColor};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    <!-- Preheader (hidden) -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${this.brand.bgColor};">
      ${escape(args.preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${this.brand.bgColor};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${this.brand.cardBgColor};border:1px solid ${this.brand.borderColor};border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <!-- Header -->
            <tr>
              <td style="padding:24px 32px;background:${accent};color:#ffffff;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#ffffff;">
                      ${escape(this.brand.brandName)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Title -->
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;color:${this.brand.textColor};letter-spacing:-0.01em;">
                  ${escape(args.title)}
                </h1>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:8px 32px 32px 32px;color:${this.brand.textColor};font-size:16px;line-height:1.6;">
                ${args.body}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:24px 32px;border-top:1px solid ${this.brand.borderColor};background:#FAFAFA;color:${this.brand.mutedColor};font-size:12px;line-height:1.5;">
                <p style="margin:0 0 4px 0;">You're receiving this because you have an account at ${escape(this.brand.brandName)}.</p>
                <p style="margin:0;">
                  Need help? Reply to this email or contact <a href="mailto:${this.brand.supportEmail}" style="color:${this.brand.mutedColor};text-decoration:underline;">${this.brand.supportEmail}</a>.
                </p>
                <p style="margin:12px 0 0 0;">© ${year} ${escape(this.brand.brandName)}. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = `${args.textIntro}\n\n--\n${this.brand.brandName}\nReply to this email or contact ${this.brand.supportEmail} for help.`;

    return { subject: args.subject, html, text };
  }

  private button(label: string, href: string): string {
    const accent = this.brand.brandColor;
    // Bulletproof button: VML for Outlook, padded link for everyone else.
    return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="center" bgcolor="${accent}" style="border-radius:8px;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" stroke="f" fillcolor="${accent}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;">${escape(label)}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-- -->
      <a href="${href}" target="_blank" style="background:${accent};border-radius:8px;color:#ffffff;display:inline-block;font-size:16px;font-weight:600;line-height:48px;text-align:center;text-decoration:none;width:240px;-webkit-text-size-adjust:none;mso-hide:all;">${escape(label)}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
  }

  private detailsTable(rows: [string, string][]): string {
    const trs = rows
      .map(
        ([k, v]) =>
          `<tr>
            <td style="padding:8px 0;color:${this.brand.mutedColor};font-size:14px;width:120px;">${escape(k)}</td>
            <td style="padding:8px 0;color:${this.brand.textColor};font-size:14px;font-weight:600;">${escape(v)}</td>
          </tr>`,
      )
      .join("");
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border:1px solid ${this.brand.borderColor};border-radius:8px;width:100%;">
      <tr><td style="padding:8px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${trs}</table></td></tr>
    </table>`;
  }
}

// Inline-style snippets used inside template bodies.
const P = "margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#1F2937;";
const SMALL = "margin:16px 0 0 0;font-size:13px;line-height:1.5;color:#6B7280;";

function escape(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
