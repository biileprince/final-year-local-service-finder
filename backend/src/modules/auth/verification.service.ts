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
const VERIFY_EMAIL_CODE_TTL_MIN = 15;

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

  // -- Email verification (6-digit code) -------------------------------------
  //
  // We store the SHA-256 of `userId:code` (not the code itself) so a leaked DB
  // dump can't be used to forge verifications. The userId-namespacing also
  // guarantees uniqueness across users — two people who happen to mint the
  // same 6-digit code at the same moment won't collide on the @unique
  // tokenHash column.

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

    const code = this.generateNumericCode(6);
    const tokenHash = this.hashCode(userId, code);
    const expiresAt = new Date(
      Date.now() + VERIFY_EMAIL_CODE_TTL_MIN * 60 * 1000,
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

    try {
      await this.emailService.send({
        to: user.email,
        subject: "Verify your email",
        template: "email-verification",
        data: {
          name: user.name,
          code,
          ttlMinutes: VERIFY_EMAIL_CODE_TTL_MIN,
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

  async verifyEmailByCode(
    userId: string,
    code: string,
  ): Promise<{ userId: string }> {
    const trimmed = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(trimmed)) {
      throw new UnprocessableDomainError(
        ErrorCode.TOKEN_INVALID,
        "Enter the 6-digit code from your email.",
      );
    }

    // If the user is already verified, treat as success. This makes the UI
    // idempotent (e.g. someone hits submit twice in quick succession).
    const user = await this.usersService.findById(userId);
    if (user.emailVerifiedAt) {
      return { userId };
    }

    const tokenHash = this.hashCode(userId, trimmed);
    const record = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (
      !record ||
      record.userId !== userId ||
      record.purpose !== VerificationPurpose.EMAIL_VERIFICATION ||
      record.usedAt ||
      record.expiresAt < new Date()
    ) {
      throw new UnprocessableDomainError(
        ErrorCode.TOKEN_INVALID,
        "That code is invalid or has expired. Tap 'Resend code' to get a new one.",
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.verificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    this.logger.log(`Email verified for user ${userId}`);
    return { userId };
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

  /** Per-user hash so two users with the same code never collide. */
  private hashCode(userId: string, code: string): string {
    return createHash("sha256").update(`${userId}:${code}`).digest("hex");
  }

  /** Cryptographically random N-digit numeric code. */
  private generateNumericCode(length: number): string {
    let out = "";
    while (out.length < length) {
      const buf = randomBytes(length);
      for (let i = 0; i < buf.length && out.length < length; i++) {
        const digit = buf[i]! % 10;
        out += digit.toString();
      }
    }
    return out;
  }
}
