import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import {
  EmailTemplatesService,
  RenderedEmail,
} from "./email-templates.service";

export type EmailTemplate =
  | "welcome"
  | "email-verification"
  | "password-reset"
  | "booking-confirmed"
  | "booking-cancelled"
  | "booking-completed"
  | "booking-reminder"
  | "new-review"
  | "provider-verified"
  | "provider-rejected"
  | "default";

export interface EmailOptions {
  to: string;
  /** Optional override; templates supply their own subject by default. */
  subject?: string;
  template: EmailTemplate | string;
  data: Record<string, any>;
  from?: string;
}

/**
 * Single entry point for transactional email. Uses Resend
 * (https://resend.com) for delivery and EmailTemplatesService for rendering.
 *
 * If `RESEND_API_KEY` is not configured, sends are logged + skipped silently
 * so dev environments don't crash; in production the env validator already
 * marks the key as required.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly replyTo?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly templates: EmailTemplatesService,
  ) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY") ?? "";
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromEmail =
      this.configService.get<string>("EMAIL_FROM") ??
      "noreply@localservicefinder.com";
    this.fromName =
      this.configService.get<string>("EMAIL_FROM_NAME") ??
      "Local Service Finder";
    this.replyTo = this.configService.get<string>("EMAIL_REPLY_TO");
  }

  async send(options: EmailOptions): Promise<boolean> {
    const rendered = this.render(options.template, options.data);
    const subject = options.subject ?? rendered.subject;

    if (!this.resend) {
      this.logger.warn(
        `RESEND_API_KEY not set — skipping email "${subject}" to ${options.to}`,
      );
      return false;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${options.from ?? this.fromEmail}>`,
        to: options.to,
        subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: this.replyTo,
      });

      if (error) {
        throw new Error(`Resend API error: ${error.name} - ${error.message}`);
      }

      // Log the Resend message ID so we can trace deliveries in the Resend
      // dashboard when a user reports "I never got the email". Most often
      // the email did send and is sitting in spam, but until the ID is in
      // the logs we can't prove that.
      this.logger.log(
        `Email sent: "${subject}" → ${options.to} (resend id: ${data?.id ?? "unknown"})`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send email "${subject}" to ${options.to}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  // -- Template dispatch ------------------------------------------------------

  private render(template: string, d: Record<string, any>): RenderedEmail {
    switch (template) {
      case "welcome":
        return this.templates.welcome({
          name: d.name,
          role: d.role ?? "CUSTOMER",
        });
      case "email-verification":
        return this.templates.emailVerification({
          name: d.name,
          code: d.code,
          ttlMinutes: d.ttlMinutes ?? 15,
        });
      case "password-reset":
        return this.templates.passwordReset({
          name: d.name,
          resetUrl: d.resetUrl,
          ttlMinutes: d.ttlMinutes ?? 60,
        });
      case "booking-confirmed":
        return this.templates.bookingConfirmed({
          recipientName: d.recipientName,
          counterpartName: d.counterpartName,
          bookingNumber: d.bookingNumber,
          date: d.date,
          time: d.time,
          address: d.address,
          isProvider: !!d.isProvider,
        });
      case "booking-cancelled":
        return this.templates.bookingCancelled({
          recipientName: d.recipientName,
          counterpartName: d.counterpartName,
          bookingNumber: d.bookingNumber,
          cancelledByLabel: d.cancelledByLabel ?? "the other party",
          reason: d.reason,
        });
      case "booking-completed":
        return this.templates.bookingCompletedReviewPrompt({
          recipientName: d.recipientName,
          providerName: d.providerName,
          bookingNumber: d.bookingNumber,
          bookingId: d.bookingId,
        });
      case "booking-reminder":
        return this.templates.bookingReminder({
          recipientName: d.recipientName,
          counterpartName: d.counterpartName,
          bookingNumber: d.bookingNumber,
          date: d.date,
          time: d.time,
          hoursUntil: d.hoursUntil ?? 24,
        });
      case "new-review":
        return this.templates.newReview({
          providerName: d.providerName,
          customerName: d.customerName,
          rating: d.rating,
          bookingNumber: d.bookingNumber,
        });
      case "provider-verified":
        return this.templates.providerVerified({
          providerName: d.providerName,
        });
      case "provider-rejected":
        return this.templates.providerRejected({
          providerName: d.providerName,
          reason: d.reason,
        });
      default:
        // Generic title/body fallback used by NotificationsService for
        // categories without a custom template (NEW_MESSAGE, SYSTEM, etc.).
        return this.templates.welcome({
          name: d.name ?? "there",
          role: d.role ?? "CUSTOMER",
        });
    }
  }
}
