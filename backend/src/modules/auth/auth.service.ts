import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { CacheService } from "../../cache/cache.service";
import { PrismaService } from "../../database/prisma.service";
import { VerificationService } from "./verification.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PasswordSecurityService } from "../../common/security/password-security.service";
import { v4 as uuidv4 } from "uuid";

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  sessionId?: string;
  tokenId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Request context captured at login so the sessions UI can show device info. */
export interface SessionContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
    private readonly notificationsService: NotificationsService,
    private readonly passwordSecurityService: PasswordSecurityService,
  ) {}

  async register(
    registerDto: RegisterDto,
    context?: SessionContext,
  ): Promise<AuthTokens> {
    const { email, password, name, phone, role } = registerDto;

    // Check if user exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException("Email already registered");
    }

    // Reject passwords that appear in known breach corpora (HIBP).
    await this.passwordSecurityService.assertNotBreached(password);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.usersService.create({
      email,
      password: hashedPassword,
      name,
      phone,
      role: role || "CUSTOMER",
    });

    this.logger.log(`New user registered: ${email}`);

    // Fire only the verification email at signup. The welcome email gets
    // delivered AFTER they verify (see verification.service `verifyEmailByCode`)
    // — otherwise two transactional emails land in the inbox at the same time
    // and users read the welcome first, missing the 6-digit code.
    void this.verificationService
      .sendEmailVerification(user.id)
      .catch((err) =>
        this.logger.warn(
          `Auto verification email failed for ${email}: ${(err as Error).message}`,
        ),
      );

    // Generate tokens
    return this.generateTokens(user, context);
  }

  async login(
    loginDto: LoginDto,
    context?: SessionContext,
  ): Promise<AuthTokens> {
    const { email, password } = loginDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    this.logger.log(`User logged in: ${email}`);

    return this.generateTokens(user, context);
  }

  async refreshTokens(
    refreshToken: string,
    context?: SessionContext,
  ): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>("JWT_SECRET"),
      });

      // Check if refresh token is valid in cache/database
      const storedToken = await this.cacheService.getRefreshToken(
        payload.sub,
        payload.tokenId,
      );

      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedException("Invalid refresh token");
      }

      // Get user
      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      // Invalidate old refresh token
      await this.cacheService.deleteRefreshToken(payload.sub, payload.tokenId);

      // Generate new tokens, preserving the stable sessionId across rotation.
      return this.generateTokens(user, context, payload.sessionId);
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      const session = await this.cacheService.getSession(userId, sessionId);
      if (session) {
        await this.cacheService.deleteRefreshToken(userId, session.tokenId);
        await this.cacheService.deleteSession(userId, sessionId);
      }
    } else {
      await this.cacheService.deleteAllRefreshTokens(userId);
      await this.cacheService.delByPattern(`session:${userId}:*`);
    }
    this.logger.log(`User logged out: ${userId}`);
  }

  private async generateTokens(
    user: {
      id: string;
      email: string;
      role: string;
    },
    context?: SessionContext,
    existingSessionId?: string,
  ): Promise<AuthTokens> {
    // tokenId rotates on every issue (refresh-token rotation); sessionId is
    // stable across rotations so the sessions UI shows one row per device.
    const tokenId = uuidv4();
    const sessionId = existingSessionId ?? uuidv4();
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(
      { ...payload, tokenId },
      {
        expiresIn: this.configService.get<string>(
          "JWT_REFRESH_EXPIRES_IN",
          "7d",
        ),
      } as Parameters<typeof this.jwtService.sign>[1],
    );

    // Store refresh token in cache
    await this.cacheService.setRefreshToken(user.id, tokenId, refreshToken);

    // Store/refresh the parallel session metadata record.
    const now = new Date().toISOString();
    const existing = existingSessionId
      ? await this.cacheService.getSession(user.id, sessionId)
      : null;
    await this.cacheService.setSession(user.id, sessionId, {
      sessionId,
      tokenId,
      ipAddress: context?.ipAddress ?? existing?.ipAddress,
      userAgent: context?.userAgent ?? existing?.userAgent,
      createdAt: existing?.createdAt ?? now,
      lastActiveAt: now,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  async validateUser(payload: TokenPayload) {
    return this.usersService.findById(payload.sub);
  }

  /** Issues a fresh access+refresh pair for a user without checking a password.
   *  Used by trusted callers (e.g. the Google OAuth flow after Google has
   *  authenticated the user). */
  async issueSessionForUserId(
    userId: string,
    context?: SessionContext,
  ): Promise<AuthTokens> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    await this.usersService.updateLastLogin(user.id);
    return this.generateTokens(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      context,
    );
  }

  // --- Session management (sessions UI) ---

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.cacheService.listSessions(userId);
    return sessions
      .map((s) => ({
        id: s.sessionId,
        ipAddress: s.ipAddress ?? null,
        userAgent: s.userAgent ?? null,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        current: s.sessionId === currentSessionId,
      }))
      .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.logout(userId, sessionId);
  }

  async revokeOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<{ revoked: number }> {
    const sessions = await this.cacheService.listSessions(userId);
    let revoked = 0;
    for (const s of sessions) {
      if (s.sessionId === currentSessionId) continue;
      await this.logout(userId, s.sessionId);
      revoked += 1;
    }
    return { revoked };
  }
}
