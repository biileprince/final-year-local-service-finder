import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { randomBytes } from "crypto";
import {
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  clearRefreshCookie,
  setCsrfCookie,
} from "../../common/security/cookies";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { VerificationService } from "./verification.service";
import { OtpService } from "./otp.service";
import { GoogleAuthService } from "./google-auth.service";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { ConfigService } from "@nestjs/config";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { SendOtpDto } from "./dto/send-otp.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { Public } from "../../common/decorators/public.decorator";
import {
  CurrentUser,
  CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

@Controller("auth")
@ApiTags("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verificationService: VerificationService,
    private readonly otpService: OtpService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post("register")
  @Public()
  @Throttle({ long: { limit: 3, ttl: 3_600_000 } }) // 3/hour per IP
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User registered successfully" })
  @ApiResponse({ status: 409, description: "Email already registered" })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(registerDto);
    this.applySessionCookies(res, tokens.refreshToken);
    return tokens;
  }

  @Post("login")
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 5, ttl: 60_000 } }) // 5/min per IP
  @ApiOperation({ summary: "Login with email and password" })
  @ApiResponse({ status: 200, description: "Login successful" })
  @ApiResponse({ status: 401, description: "Invalid credentials" })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(loginDto);
    this.applySessionCookies(res, tokens.refreshToken);
    return tokens;
  }

  @Post("refresh")
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 30, ttl: 60_000 } }) // 30/min per IP
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({ status: 200, description: "Tokens refreshed successfully" })
  @ApiResponse({ status: 401, description: "Invalid refresh token" })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Prefer the httpOnly cookie if present; fall back to JSON body for
    // backward compatibility with bearer-only clients (mobile apps, scripts).
    const fromCookie = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const refreshToken = fromCookie ?? refreshTokenDto?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const tokens = await this.authService.refreshTokens(refreshToken);
    this.applySessionCookies(res, tokens.refreshToken);
    return tokens;
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Logout user" })
  @ApiResponse({ status: 200, description: "Logged out successfully" })
  async logout(
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id);
    clearRefreshCookie(res);
    return { message: "Logged out successfully" };
  }

  /**
   * Sets the httpOnly refresh-token cookie + the readable double-submit CSRF
   * cookie. Frontend reads `lsf_csrf_token` and echoes it in `x-csrf-token`
   * on mutating requests (enforced when CSRF_ENABLED=true).
   */
  private applySessionCookies(res: Response, refreshToken: string): void {
    setRefreshCookie(res, refreshToken);
    setCsrfCookie(res, randomBytes(32).toString("base64url"));
  }

  // -- Password reset  -------------------------------------------------------

  @Post("forgot-password")
  @Public()
  @Throttle({ long: { limit: 3, ttl: 3_600_000 } }) // 3/hour per IP
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: "Request a password reset email",
    description:
      "Always returns 202 regardless of whether the email exists, to prevent account enumeration.",
  })
  @ApiResponse({
    status: 202,
    description: "Reset email sent if account exists",
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await this.verificationService.requestPasswordReset(dto.email, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return {
      message:
        "If an account exists for that email, a 6-digit reset code has been sent.",
    };
  }

  @Post("reset-password")
  @Public()
  @Throttle({ long: { limit: 5, ttl: 900_000 } }) // 5/15min per IP
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reset password using the 6-digit code emailed to the user",
  })
  @ApiResponse({ status: 200, description: "Password reset successfully" })
  @ApiResponse({ status: 422, description: "Code invalid or expired" })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.verificationService.resetPassword(
      dto.email,
      dto.code,
      dto.newPassword,
    );
    return {
      message: "Password updated. You can now log in with your new password.",
    };
  }

  // -- Email verification ---------------------------------------------------

  @Post("send-verification")
  @UseGuards(JwtAuthGuard)
  @Throttle({ long: { limit: 3, ttl: 3_600_000 } }) // 3/hour per IP
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Send (or resend) the 6-digit verification code" })
  @ApiResponse({ status: 202, description: "Verification code emailed" })
  async sendVerification(
    @CurrentUser() user: CurrentUserPayload,
    @Req() req: Request,
  ) {
    await this.verificationService.sendEmailVerification(user.id, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return { message: "We've emailed you a 6-digit verification code." };
  }

  @Post("verify-email")
  @UseGuards(JwtAuthGuard)
  @Throttle({ long: { limit: 10, ttl: 900_000 } }) // 10/15min per IP
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Confirm email by submitting the 6-digit code" })
  @ApiResponse({ status: 200, description: "Email verified" })
  @ApiResponse({ status: 422, description: "Code invalid or expired" })
  async verifyEmail(
    @CurrentUser() user: CurrentUserPayload,
    @Body() body: { code: string },
  ) {
    const result = await this.verificationService.verifyEmailByCode(
      user.id,
      body?.code ?? "",
    );
    return { message: "Email verified.", userId: result.userId };
  }

  // -- Phone OTP ------------------------------------------------------------

  @Post("send-otp")
  @UseGuards(JwtAuthGuard)
  @Throttle({ long: { limit: 3, ttl: 1_800_000 } }) // 3/30min per IP (service-level limit also applies per user)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Send a 6-digit SMS verification code to the user's phone",
  })
  @ApiResponse({ status: 202, description: "OTP sent (or rate-limited)" })
  async sendOtp(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SendOtpDto,
  ) {
    const result = await this.otpService.sendOtp(user.id, dto.phone);
    return { message: `Code sent to ${result.sentTo}.` };
  }

  @Post("verify-otp")
  @UseGuards(JwtAuthGuard)
  @Throttle({ long: { limit: 5, ttl: 900_000 } }) // 5/15min per IP (service-level lockout also applies per user)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Verify the 6-digit SMS code" })
  @ApiResponse({ status: 200, description: "Phone verified" })
  @ApiResponse({ status: 422, description: "Code invalid or expired" })
  async verifyOtp(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: VerifyOtpDto,
  ) {
    await this.otpService.verifyOtp(user.id, dto.code);
    return { message: "Phone verified." };
  }

  // -- Google OAuth ----------------------------------------------------------
  //
  // Flow:
  //   1) Browser hits  GET /auth/google?role=PROVIDER  (or no role).
  //      The GoogleAuthGuard signs the role hint into the OAuth `state` and
  //      redirects to Google.
  //   2) Google bounces back to  GET /auth/google/callback?state=...&code=...
  //      where Passport verifies + decodes the profile. We then either:
  //        a) issue a short-lived exchange code and redirect to
  //           FRONTEND_URL/oauth/return?code=...   (existing user OR new
  //           user with a role hint), or
  //        b) issue a signup token and redirect to
  //           FRONTEND_URL/oauth/finish?signup=...&email=...&name=...
  //           (new user, no role hint — the page asks them to pick).
  //   3) Frontend POSTs the code/signup token back to /auth/google/exchange
  //      or /auth/google/complete, which returns real access + refresh tokens.

  @Get("google")
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: "Start the Google OAuth flow" })
  async googleStart() {
    // GoogleAuthGuard handles the redirect. Method body never executes.
  }

  @Get("google/callback")
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: "Google OAuth callback — completes the handshake" })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const frontendUrl =
      this.configService.get<string>("FRONTEND_URL") ?? "http://localhost:3000";

    const profile = req.user as
      | {
          googleId: string;
          email: string;
          name: string;
          picture?: string;
        }
      | undefined;

    if (!profile) {
      return res.redirect(`${frontendUrl}/login?reason=google-failed`);
    }

    const stateRaw =
      typeof req.query.state === "string" ? req.query.state : undefined;
    const state = this.googleAuthService.decodeState(stateRaw);

    const result = await this.googleAuthService.handleProfile(
      profile,
      state?.role,
    );

    if (result.kind === "session") {
      const params = new URLSearchParams({ code: result.code });
      if (state?.returnUrl) params.set("returnUrl", state.returnUrl);
      return res.redirect(`${frontendUrl}/oauth/return?${params.toString()}`);
    }

    const params = new URLSearchParams({
      signup: result.signupToken,
      email: result.profile.email,
      name: result.profile.name,
    });
    if (result.profile.picture) params.set("picture", result.profile.picture);
    if (state?.returnUrl) params.set("returnUrl", state.returnUrl);
    return res.redirect(`${frontendUrl}/oauth/finish?${params.toString()}`);
  }

  @Post("google/exchange")
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: "Exchange a one-time OAuth code for access + refresh tokens",
  })
  async googleExchange(
    @Body() body: { code?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body?.code) {
      throw new BadRequestException("Missing exchange code");
    }
    const userId = await this.googleAuthService.exchangeCodeForUserId(
      body.code,
    );
    const tokens = await this.authService.issueSessionForUserId(userId);
    this.applySessionCookies(res, tokens.refreshToken);
    return tokens;
  }

  @Post("google/complete")
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ long: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: "Finish a Google signup once the user picks a role",
  })
  async googleComplete(
    @Body() body: { signup?: string; role?: "CUSTOMER" | "PROVIDER" },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body?.signup) {
      throw new BadRequestException("Missing signup token");
    }
    if (body.role !== "CUSTOMER" && body.role !== "PROVIDER") {
      throw new BadRequestException("role must be CUSTOMER or PROVIDER");
    }
    const { code } = await this.googleAuthService.completePendingSignup(
      body.signup,
      body.role,
    );
    const userId = await this.googleAuthService.exchangeCodeForUserId(code);
    const tokens = await this.authService.issueSessionForUserId(userId);
    this.applySessionCookies(res, tokens.refreshToken);
    return tokens;
  }
}
