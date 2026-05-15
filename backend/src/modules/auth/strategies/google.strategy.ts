import { Injectable } from "@nestjs/common";
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
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(configService: ConfigService) {
    super({
      clientID:
        configService.get<string>("GOOGLE_CLIENT_ID") ?? "google-oauth-disabled",
      clientSecret:
        configService.get<string>("GOOGLE_CLIENT_SECRET") ??
        "google-oauth-disabled",
      callbackURL:
        configService.get<string>("GOOGLE_CALLBACK_URL") ??
        `${configService.get<string>("FRONTEND_URL") ?? "http://localhost:3001"}/auth/google/callback`,
      scope: ["email", "profile"],
    });
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
