import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { VerificationPurpose } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../database/prisma.service";
import { EmailService } from "../notifications/services/email.service";
import { UsersService } from "../users/users.service";
import {
  DomainError,
  ErrorCode,
  UnprocessableDomainError,
} from "../../common/errors";

const RESET_TOKEN_TTL_MIN = 60;
const VERIFY_EMAIL_TOKEN_TTL_HRS = 24;

/**
 * Owns the "long URL token" verification flows: password reset and email
 * verification. Phone OTP lives in OtpService (Redis-backed).
 *
 * Token storage strategy:
 *  - We generate a 32-byte random token and email the raw value to the user.
 *  - Only the SHA-256 hash is persisted, so a leaked DB dump cannot be used to
 *    impersonate password-reset or email-verification flows.
 *  - On consume, we re-hash the inbound token and look it up.
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl =
      this.configService.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
  }

  // -- Password reset ---------------------------------------------------------

  async requestPasswordReset(
    email: string,
    actor?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    // Important: never reveal whether the email exists. Always return success
    // shape; only actually issue + email a token if the user exists.
    if (!user) {
      this.logger.debug(
        `Password reset requested for unknown email (no token issued)`,
      );
      return;
    }

    // Invalidate any outstanding reset tokens for this user so an attacker
    // who has briefly captured an old token can't use it after a new request.
    await this.prisma.verificationToken.updateMany({
      where: {
        userId: user.id,
        purpose: VerificationPurpose.PASSWORD_RESET,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    const { rawToken, tokenHash, expiresAt } = this.mintToken(
      RESET_TOKEN_TTL_MIN * 60 * 1000,
    );

    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        purpose: VerificationPurpose.PASSWORD_RESET,
        tokenHash,
        expiresAt,
        ipAddress: actor?.ipAddress,
        userAgent: actor?.userAgent,
      },
    });

    const resetUrl = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.emailService.send({
        to: user.email,
        subject: "Reset your password",
        template: "password-reset",
        data: {
          title: "Reset your password",
          name: user.name,
          resetUrl,
          ttlMinutes: RESET_TOKEN_TTL_MIN,
          message: `You (or someone using your email) requested a password reset. Click the link below to choose a new password. This link expires in ${RESET_TOKEN_TTL_MIN} minutes.`,
        },
      });
    } catch (err) {
      // Email failure is logged but not surfaced — see the "don't reveal
      // existence" comment above. The user can request again.
      this.logger.error(
        `Failed to send password-reset email to ${user.email}`,
        err as Error,
      );
    }
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (
      !record ||
      record.purpose !== VerificationPurpose.PASSWORD_RESET ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new UnprocessableDomainError(
        ErrorCode.PASSWORD_RESET_TOKEN_INVALID,
        "This password reset link is invalid or has expired. Request a new one.",
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Revoke any existing refresh tokens for the user — successful reset
      // implies all prior sessions should be terminated.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "password_reset" },
      }),
    ]);

    this.logger.log(`Password reset completed for user ${record.userId}`);
  }

  // -- Email verification -----------------------------------------------------

  async sendEmailVerification(
    userId: string,
    actor?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (user.emailVerifiedAt) {
      // Idempotent — don't error, don't email.
      return;
    }

    await this.prisma.verificationToken.updateMany({
      where: {
        userId,
        purpose: VerificationPurpose.EMAIL_VERIFICATION,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    const { rawToken, tokenHash, expiresAt } = this.mintToken(
      VERIFY_EMAIL_TOKEN_TTL_HRS * 60 * 60 * 1000,
    );

    await this.prisma.verificationToken.create({
      data: {
        userId,
        purpose: VerificationPurpose.EMAIL_VERIFICATION,
        tokenHash,
        expiresAt,
        ipAddress: actor?.ipAddress,
        userAgent: actor?.userAgent,
      },
    });

    const verifyUrl = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

    try {
      await this.emailService.send({
        to: user.email,
        subject: "Verify your email",
        template: "email-verification",
        data: {
          title: "Verify your email",
          name: user.name,
          verifyUrl,
          ttlHours: VERIFY_EMAIL_TOKEN_TTL_HRS,
          message: `Please confirm your email by clicking the link below. This link expires in ${VERIFY_EMAIL_TOKEN_TTL_HRS} hours.`,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to send verification email to ${user.email}`,
        err as Error,
      );
      throw new DomainError(
        ErrorCode.INTERNAL_ERROR,
        "Could not send verification email. Please try again.",
      );
    }
  }

  async verifyEmail(rawToken: string): Promise<{ userId: string }> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (
      !record ||
      record.purpose !== VerificationPurpose.EMAIL_VERIFICATION ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new UnprocessableDomainError(
        ErrorCode.TOKEN_INVALID,
        "This verification link is invalid or has expired. Request a new one.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    this.logger.log(`Email verified for user ${record.userId}`);
    return { userId: record.userId };
  }

  // -- Helpers ----------------------------------------------------------------

  private mintToken(ttlMs: number) {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlMs);
    return { rawToken, tokenHash, expiresAt };
  }

  private hashToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}
