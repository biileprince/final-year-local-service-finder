import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface SmsOptions {
  to: string;
  message: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly twilioAccountSid: string;
  private readonly twilioAuthToken: string;
  private readonly twilioPhoneNumber: string;
  private readonly smsProvider: "twilio" | "africas_talking";

  constructor(private readonly configService: ConfigService) {
    this.smsProvider =
      this.configService.get<"twilio" | "africas_talking">("SMS_PROVIDER") ||
      "twilio";

    // Twilio config
    this.twilioAccountSid =
      this.configService.get<string>("TWILIO_ACCOUNT_SID") || "";
    this.twilioAuthToken =
      this.configService.get<string>("TWILIO_AUTH_TOKEN") || "";
    this.twilioPhoneNumber =
      this.configService.get<string>("TWILIO_PHONE_NUMBER") || "";
  }

  async send(options: SmsOptions): Promise<boolean> {
    const { to, message } = options;

    // Format phone number (ensure it has country code)
    const formattedPhone = this.formatPhoneNumber(to);

    if (this.smsProvider === "twilio") {
      return this.sendViaTwilio(formattedPhone, message);
    } else {
      return this.sendViaAfricasTalking(formattedPhone, message);
    }
  }

  private async sendViaTwilio(to: string, message: string): Promise<boolean> {
    if (!this.twilioAccountSid || !this.twilioAuthToken) {
      this.logger.warn("Twilio credentials not configured, skipping SMS");
      return false;
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: this.twilioPhoneNumber,
          Body: message,
        }).toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Twilio API error: ${errorData.message}`);
      }

      this.logger.log(`SMS sent successfully to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${error.message}`);
      throw error;
    }
  }

  private async sendViaAfricasTalking(
    to: string,
    message: string,
  ): Promise<boolean> {
    const apiKey = this.configService.get<string>("AT_API_KEY");
    const username = this.configService.get<string>("AT_USERNAME");
    const shortCode = this.configService.get<string>("AT_SHORTCODE");

    if (!apiKey || !username) {
      this.logger.warn(
        "Africa's Talking credentials not configured, skipping SMS",
      );
      return false;
    }

    try {
      const url = "https://api.africastalking.com/version1/messaging";

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          apiKey: apiKey,
        },
        body: new URLSearchParams({
          username,
          to,
          message,
          ...(shortCode && { from: shortCode }),
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Africa's Talking API error: ${errorText}`);
      }

      const data = await response.json();

      if (data.SMSMessageData?.Recipients?.[0]?.status !== "Success") {
        throw new Error(`SMS delivery failed: ${data.SMSMessageData?.Message}`);
      }

      this.logger.log(`SMS sent successfully to ${to} via Africa's Talking`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}: ${error.message}`);
      throw error;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, "");

    // Handle Ghana phone numbers
    if (cleaned.startsWith("0")) {
      // Convert local format (0244...) to international (+233244...)
      cleaned = "233" + cleaned.substring(1);
    }

    // Ensure it starts with +
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }

    return cleaned;
  }
}
