import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  from?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sendgridApiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    this.sendgridApiKey =
      this.configService.get<string>("SENDGRID_API_KEY") || "";
    this.fromEmail =
      this.configService.get<string>("EMAIL_FROM") ||
      "noreply@localservicefinder.com";
    this.fromName =
      this.configService.get<string>("EMAIL_FROM_NAME") ||
      "Local Service Finder";
  }

  async send(options: EmailOptions): Promise<boolean> {
    const { to, subject, template, data, from } = options;

    if (!this.sendgridApiKey) {
      this.logger.warn("SendGrid API key not configured, skipping email");
      return false;
    }

    try {
      const htmlContent = this.renderTemplate(template, data);
      const textContent = this.renderTextTemplate(template, data);

      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: {
            email: from || this.fromEmail,
            name: this.fromName,
          },
          subject,
          content: [
            { type: "text/plain", value: textContent },
            { type: "text/html", value: htmlContent },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `SendGrid API error: ${response.status} - ${errorText}`,
        );
      }

      this.logger.log(`Email sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      throw error;
    }
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    const templates: Record<string, (data: any) => string> = {
      "booking-confirmed": (d) => `
        <!DOCTYPE html>
        <html>
        <head><style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 4px; }
        </style></head>
        <body>
          <div class="container">
            <div class="header"><h1>Booking Confirmed</h1></div>
            <div class="content">
              <p>Hello,</p>
              <p>${d.message}</p>
              <p><strong>Booking Details:</strong></p>
              <ul>
                <li>Booking Number: ${d.bookingNumber || "N/A"}</li>
                <li>Date: ${d.date || "N/A"}</li>
                <li>Time: ${d.time || "N/A"}</li>
                ${d.providerName ? `<li>Provider: ${d.providerName}</li>` : ""}
              </ul>
              <p>Thank you for using Local Service Finder!</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Local Service Finder</p>
            </div>
          </div>
        </body>
        </html>
      `,

      "booking-cancelled": (d) => `
        <!DOCTYPE html>
        <html>
        <head><style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #DC2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style></head>
        <body>
          <div class="container">
            <div class="header"><h1>Booking Cancelled</h1></div>
            <div class="content">
              <p>Hello,</p>
              <p>${d.message}</p>
              <p>If you have any questions, please contact support.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Local Service Finder</p>
            </div>
          </div>
        </body>
        </html>
      `,

      "booking-reminder": (d) => `
        <!DOCTYPE html>
        <html>
        <head><style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #F59E0B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style></head>
        <body>
          <div class="container">
            <div class="header"><h1>Booking Reminder</h1></div>
            <div class="content">
              <p>Hello,</p>
              <p>${d.message}</p>
              <p><strong>Details:</strong></p>
              <ul>
                <li>Date: ${d.date || "N/A"}</li>
                <li>Time: ${d.time || "N/A"}</li>
              </ul>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Local Service Finder</p>
            </div>
          </div>
        </body>
        </html>
      `,

      default: (d) => `
        <!DOCTYPE html>
        <html>
        <head><style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style></head>
        <body>
          <div class="container">
            <div class="header"><h1>${d.title}</h1></div>
            <div class="content">
              <p>${d.message}</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Local Service Finder</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const templateFn = templates[template] || templates.default;
    return templateFn(data);
  }

  private renderTextTemplate(
    template: string,
    data: Record<string, any>,
  ): string {
    return `${data.title}\n\n${data.message}\n\nLocal Service Finder`;
  }
}
