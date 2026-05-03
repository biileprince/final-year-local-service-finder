import { Injectable, Logger } from "@nestjs/common";
import { createHash, randomInt } from "crypto";
import { PrismaService } from "../../database/prisma.service";
import { CacheService } from "../../cache/cache.service";
import { SmsService } from "../notifications/services/sms.service";
import { UsersService } from "../users/users.service";
import {
  ConflictDomainError,
  ErrorCode,
  UnprocessableDomainError,
} from "../../common/errors";

const OTP_TTL_SECONDS = 5 * 60;          // code valid 5 min
const SENDS_WINDOW_SECONDS = 30 * 60;    // throttle window
const MAX_SENDS_PER_WINDOW = 3;          // max 3 sends per 30 min
const FAILS_WINDOW_SECONDS = 15 * 60;
const MAX_FAILS_PER_WINDOW = 5;          // lock further verify after 5 wrong codes

/**
 * Phone OTP verification, Redis-backed.
 *
 * Storage layout:
 *   otp:phone:code:{userId}       -> SHA-256(code)             TTL = 5 min
 *   otp:phone:phone:{userId}      -> phone number we sent to   TTL = 5 min
 *   otp:phone:sends:{userId}      -> incrementing counter      TTL = 30 min
 *   otp:phone:fails:{userId}      -> incrementing counter      TTL = 15 min
 *
 * Rate-limit decisions are per-user (sender or verifier), not per-phone, to
 * keep things simple. If users can change phone numbers freely, switch the
 * keys to `{userId}:{phone}` shape.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly sms: SmsService,
    private readonly users: UsersService,
  ) {}

  async sendOtp(userId: string, phone?: string): Promise<{ sentTo: string }> {
    const user = await this.users.findById(userId);
    const targetPhone = phone ?? user.phone;

    if (!targetPhone) {
      throw new UnprocessableDomainError(
        ErrorCode.VALIDATION_FAILED,
        "No phone number on file. Provide a phone number to verify.",
      );
    }

    // Send-rate limit
    const sends = await this.cache.incrementRateLimit(
      this.sendsKey(userId),
      SENDS_WINDOW_SECONDS,
    );
    if (sends > MAX_SENDS_PER_WINDOW) {
      throw new ConflictDomainError(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        "Too many OTP requests. Try again later.",
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = this.hashCode(code);

    await this.cache.set(this.codeKey(userId), codeHash, OTP_TTL_SECONDS);
    await this.cache.set(this.phoneKey(userId), targetPhone, OTP_TTL_SECONDS);

    // Reset prior fail counter on resend so a stuck user isn't locked out.
    await this.cache.del(this.failsKey(userId));

    try {
      await this.sms.send({
        to: targetPhone,
        message: `${code} is your Local Service Finder verification code. It expires in ${OTP_TTL_SECONDS / 60} minutes. Don't share this code.`,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send OTP SMS to ${targetPhone}`,
        err as Error,
      );
      // Don't surface the SMS error verbatim — caller can retry. Keep the
      // OTP in cache so a delayed delivery still works.
    }

    return { sentTo: this.maskPhone(targetPhone) };
  }

  async verifyOtp(userId: string, code: string): Promise<void> {
    const fails = await this.cache.getRateLimitCount(this.failsKey(userId));
    if (fails >= MAX_FAILS_PER_WINDOW) {
      throw new ConflictDomainError(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        "Too many wrong codes. Request a new code and try again later.",
      );
    }

    const stored = await this.cache.get<string>(this.codeKey(userId));
    if (!stored) {
      throw new UnprocessableDomainError(
        ErrorCode.TOKEN_EXPIRED,
        "Verification code has expired. Request a new one.",
      );
    }

    if (stored !== this.hashCode(code)) {
      await this.cache.incrementRateLimit(
        this.failsKey(userId),
        FAILS_WINDOW_SECONDS,
      );
      throw new UnprocessableDomainError(
        ErrorCode.TOKEN_INVALID,
        "Incorrect verification code.",
      );
    }

    const phone = await this.cache.get<string>(this.phoneKey(userId));

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerifiedAt: new Date(),
        // Persist the phone we verified, in case the user supplied a new
        // phone in sendOtp() that differs from their account record.
        ...(phone ? { phone } : {}),
      },
    });

    // Clean up so the same code can't be replayed.
    await Promise.all([
      this.cache.del(this.codeKey(userId)),
      this.cache.del(this.phoneKey(userId)),
      this.cache.del(this.failsKey(userId)),
    ]);

    this.logger.log(`Phone verified for user ${userId}`);
  }

  // -- Helpers --------------------------------------------------------------

  private codeKey(userId: string) {
    return `otp:phone:code:${userId}`;
  }
  private phoneKey(userId: string) {
    return `otp:phone:phone:${userId}`;
  }
  private sendsKey(userId: string) {
    return `otp:phone:sends:${userId}`;
  }
  private failsKey(userId: string) {
    return `otp:phone:fails:${userId}`;
  }

  private hashCode(code: string) {
    return createHash("sha256").update(code).digest("hex");
  }

  private maskPhone(phone: string) {
    // +233241234567 -> +233·····4567
    if (phone.length < 6) return "·····";
    return `${phone.slice(0, 4)}${"·".repeat(phone.length - 8)}${phone.slice(-4)}`;
  }
}
