import { Injectable, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile, VerifyCallback } from "passport-google-oauth20";
import { ConfigService } from "@nestjs/config";

/**
 * The strategy only extracts the Google profile and hands it back to the
 * route handler — we do the user lookup / create logic in GoogleAuthService.
 * If GOOGLE_CLIENT_ID is missing we still register a dummy strategy with
 * placeholder credentials so the AuthGuard('google') decorator resolves; the
 * controller checks `googleAuthEnabled` and returns a clean error before
 * any request actually hits the strategy.
 *
 * Callback URL resolution order:
 *   1. `GOOGLE_CALLBACK_URL` (explicit override — set this in production)
 *   2. `BACKEND_URL` + "/api/auth/google/callback"
 *   3. "http://localhost:3001/api/auth/google/callback" (dev default)
 *
 * IMPORTANT: the URL set here must exactly match an entry under "Authorized
 * redirect URIs" in the Google Cloud Console for the OAuth client.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  private static readonly logger = new Logger(GoogleStrategy.name);

  constructor(configService: ConfigService) {
    const explicit = configService.get<string>("GOOGLE_CALLBACK_URL");
    const backendBase =
      configService.get<string>("BACKEND_URL") ?? "http://localhost:3001";
    const callbackURL = explicit ?? `${backendBase}/api/auth/google/callback`;

    super({
      clientID:
        configService.get<string>("GOOGLE_CLIENT_ID") ?? "google-oauth-disabled",
      clientSecret:
        configService.get<string>("GOOGLE_CLIENT_SECRET") ??
        "google-oauth-disabled",
      callbackURL,
      scope: ["email", "profile"],
    });

    GoogleStrategy.logger.log(
      `Google OAuth callback URL resolved to: ${callbackURL}`,
    );
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error("Google account has no email"), false);
    }
    const picture = profile.photos?.[0]?.value;
    done(null, {
      googleId: profile.id,
      email,
      name: profile.displayName ?? email.split("@")[0],
      picture,
    });
  }
}

export interface GoogleProfilePayload {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}
