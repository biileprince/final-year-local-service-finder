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
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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

  async register(registerDto: RegisterDto): Promise<AuthTokens> {
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
    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto): Promise<AuthTokens> {
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

    return this.generateTokens(user);
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
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

      // Generate new tokens
      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  async logout(userId: string, tokenId?: string): Promise<void> {
    if (tokenId) {
      await this.cacheService.deleteRefreshToken(userId, tokenId);
    } else {
      await this.cacheService.deleteAllRefreshTokens(userId);
    }
    this.logger.log(`User logged out: ${userId}`);
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    role: string;
  }): Promise<AuthTokens> {
    const tokenId = uuidv4();
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
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
  async issueSessionForUserId(userId: string): Promise<AuthTokens> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    await this.usersService.updateLastLogin(user.id);
    return this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
