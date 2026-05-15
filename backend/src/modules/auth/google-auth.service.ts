import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "crypto";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";
import { PrismaService } from "../../database/prisma.service";
import { GoogleProfilePayload } from "./strategies/google.strategy";

const SIGNUP_TOKEN_TTL = "10m";
const EXCHANGE_CODE_TTL = "5m";
const STATE_TTL = "10m";

interface SignupTokenPayload {
  purpose: "oauth_signup_pending";
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

interface ExchangeCodePayload {
  purpose: "oauth_exchange";
  userId: string;
}

interface OauthStatePayload {
  purpose: "oauth_state";
  role?: "CUSTOMER" | "PROVIDER";
  returnUrl?: string;
}

export type HandleProfileResult =
  | { kind: "session"; code: string }
  | {
      kind: "pending";
      signupToken: string;
      profile: { email: string; name: string; picture?: string };
    };

/**
 * Bridges Google OAuth profiles to local users.
 *
 *  - Existing user (matched by googleId OR email): return a short-lived
 *    exchange code the frontend trades for real session tokens.
 *  - Brand-new user with a known role hint (from /register's role picker):
 *    create the account, set emailVerifiedAt (Google already verified the
 *    address), return an exchange code.
 *  - Brand-new user with NO role hint (from /login): return a signup token
 *    so the frontend can show a 'Finish setting up' screen that asks for the
 *    role, then completes the signup via `completePendingSignup`.
 */
@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const secret = this.configService.get<string>("JWT_SECRET");
    if (!secret) throw new Error("JWT_SECRET is required");
    this.jwtSecret = secret;
  }

  isEnabled(): boolean {
    return !!this.configService.get<string>("GOOGLE_CLIENT_ID");
  }

  // -- State (role hint passed through Google's redirect) ---------------------

  signState(payload: Omit<OauthStatePayload, "purpose">): string {
    return this.jwtService.sign(
      { ...payload, purpose: "oauth_state" } satisfies OauthStatePayload,
      { secret: this.jwtSecret, expiresIn: STATE_TTL },
    );
  }

  decodeState(state: string | undefined): OauthStatePayload | null {
    if (!state) return null;
    try {
      const payload = this.jwtService.verify<OauthStatePayload>(state, {
        secret: this.jwtSecret,
      });
      if (payload.purpose !== "oauth_state") return null;
      return payload;
    } catch {
      return null;
    }
  }

  // -- Main entry: take a verified Google profile, return next step ----------

  async handleProfile(
    profile: GoogleProfilePayload,
    roleHint?: "CUSTOMER" | "PROVIDER",
  ): Promise<HandleProfileResult> {
    // 1) Match by googleId — fast path for returning OAuth users.
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    // 2) Match by email — first time using Google with a pre-existing local
    //    account. Link the googleId and proceed.
    if (!user) {
      const byEmail = await this.usersService.findByEmail(profile.email);
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: profile.googleId,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
            // Backfill avatar only if the user hasn't uploaded one.
            profileImage: byEmail.profileImage ?? profile.picture,
          },
        });
        this.logger.log(`Linked Google to existing user ${user.id}`);
      }
    }

    if (user) {
      await this.usersService.updateLastLogin(user.id);
      return { kind: "session", code: this.issueExchangeCode(user.id) };
    }

    // 3) Brand-new user.
    if (roleHint) {
      const created = await this.createOauthUser(profile, roleHint);
      return { kind: "session", code: this.issueExchangeCode(created.id) };
    }

    return {
      kind: "pending",
      signupToken: this.issueSignupToken(profile),
      profile: {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      },
    };
  }

  async completePendingSignup(
    signupToken: string,
    role: "CUSTOMER" | "PROVIDER",
  ): Promise<{ code: string }> {
    let payload: SignupTokenPayload;
    try {
      payload = this.jwtService.verify<SignupTokenPayload>(signupToken, {
        secret: this.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException(
        "Signup session expired. Try Continue with Google again.",
      );
    }
    if (payload.purpose !== "oauth_signup_pending") {
      throw new UnauthorizedException("Invalid signup session.");
    }

    // Guard against the race where the same email signed up via another path
    // between issuing the signup token and the user picking a role.
    const existingByEmail = await this.usersService.findByEmail(payload.email);
    if (existingByEmail) {
      const linked = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: existingByEmail.googleId ?? payload.googleId,
          emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date(),
        },
      });
      return { code: this.issueExchangeCode(linked.id) };
    }

    const created = await this.createOauthUser(
      {
        googleId: payload.googleId,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
      role,
    );
    return { code: this.issueExchangeCode(created.id) };
  }

  async exchangeCodeForUserId(code: string): Promise<string> {
    let payload: ExchangeCodePayload;
    try {
      payload = this.jwtService.verify<ExchangeCodePayload>(code, {
        secret: this.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException(
        "Sign-in link expired. Try Continue with Google again.",
      );
    }
    if (payload.purpose !== "oauth_exchange") {
      throw new UnauthorizedException("Invalid sign-in link.");
    }
    return payload.userId;
  }

  // -- Helpers ----------------------------------------------------------------

  private issueSignupToken(profile: GoogleProfilePayload): string {
    const payload: SignupTokenPayload = {
      purpose: "oauth_signup_pending",
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };
    return this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: SIGNUP_TOKEN_TTL,
    });
  }

  private issueExchangeCode(userId: string): string {
    const payload: ExchangeCodePayload = { purpose: "oauth_exchange", userId };
    return this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: EXCHANGE_CODE_TTL,
    });
  }

  private async createOauthUser(
    profile: GoogleProfilePayload,
    role: "CUSTOMER" | "PROVIDER",
  ) {
    // OAuth-only accounts still have a non-null password column in the DB; we
    // store an unguessable random hash so the password-login path can never
    // authenticate as this user (bcrypt.compare against a real password will
    // always fail).
    const randomPassword = randomBytes(32).toString("base64url");
    const hashed = await bcrypt.hash(randomPassword, 10);
    const user = await this.usersService.create({
      email: profile.email,
      password: hashed,
      name: profile.name,
      role,
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: profile.googleId,
        emailVerifiedAt: new Date(),
        profileImage: profile.picture,
      },
    });
    this.logger.log(`Created Google OAuth user ${user.id} (${role})`);
    return user;
  }
}
