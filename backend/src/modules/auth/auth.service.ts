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
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthTokens> {
    const { email, password, name, phone, role } = registerDto;

    // Check if user exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException("Email already registered");
    }

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
}
