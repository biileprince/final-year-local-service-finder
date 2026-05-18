import { z } from "zod";

const nodeEnv = z.enum(["development", "test", "production"]);

const envSchema = z.object({
  NODE_ENV: nodeEnv.default("development"),
  PORT: z.coerce.number().int().positive().default(3001),

  // --- Database ---
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres connection string",
    ),
  // Unpooled connection for Prisma Migrate (Neon requires the non-pooler URL
  // because pgbouncer doesn't support all the prepared statements Migrate
  // uses). Falls back to DATABASE_URL when unset.
  DIRECT_URL: z.string().optional(),

  // --- Redis ---
  // REDIS_URL takes precedence (Upstash/Heroku Redis style, rediss:// → TLS).
  // Discrete host/port/password are kept for local docker-compose.
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // --- Auth ---
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be >= 32 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // --- Frontend / CORS ---
  FRONTEND_URL: z.url().default("http://localhost:3000"),
  // Public origin of *this* backend. Used to derive the Google OAuth callback
  // URL when GOOGLE_CALLBACK_URL isn't pinned explicitly. On Heroku set to
  // e.g. https://your-app.herokuapp.com (no trailing slash).
  BACKEND_URL: z.url().default("http://localhost:3001"),

  // --- Google OAuth (optional; when set, "Continue with Google" is enabled) ---
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Full URL Google should redirect back to after the consent screen. If left
  // unset, defaults to `${BACKEND_URL}/auth/google/callback` (excluded from
  // the global `/api` prefix in main.ts). Must be listed under "Authorized
  // redirect URIs" in the Google Cloud Console.
  GOOGLE_CALLBACK_URL: z.string().optional(),

  // --- Cookies / CSRF ---
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECRET: z.string().min(16).optional(),
  CSRF_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .describe(
      "When 'true', the CsrfGuard rejects mutating cookie-session requests without a matching x-csrf-token header. Flip on once the frontend integrates the cookie/header echo.",
    ),

  // --- Cloudinary (required in production) ---
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // --- Email (Resend; required in production) ---
  RESEND_API_KEY: z.string().optional(),
  // Legacy — read for backwards compatibility, no longer used.
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.email().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  EMAIL_REPLY_TO: z.email().optional(),

  // --- SMS provider switch + credentials ---
  // "disabled" turns off SMS entirely (production won't require creds).
  SMS_PROVIDER: z
    .enum(["twilio", "africas_talking", "disabled"])
    .default("disabled"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  AT_USERNAME: z.string().optional(),
  AT_API_KEY: z.string().optional(),
  AT_SHORTCODE: z.string().optional(),

  // --- Sentry (optional) ---
  SENTRY_DSN: z.url().optional(),

  // --- Metrics scrape protection ---
  // When both are set, /metrics requires HTTP Basic auth matching these.
  // Grafana Cloud's hosted Prometheus uses this when scraping over the
  // public internet.
  METRICS_AUTH_USER: z.string().optional(),
  METRICS_AUTH_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const PROD_REQUIRED: (keyof Env)[] = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "COOKIE_SECRET",
];

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment variables:\n${issues}\n\nFix your .env file before starting the application.`,
    );
  }

  const env = parsed.data;

  if (env.NODE_ENV === "production") {
    const missing = PROD_REQUIRED.filter((k) => !env[k]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(", ")}`,
      );
    }

    // SMS provider must have its credentials when in prod (unless disabled)
    if (env.SMS_PROVIDER === "twilio") {
      const smsMissing = (
        ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"] as const
      ).filter((k) => !env[k]);
      if (smsMissing.length > 0) {
        throw new Error(
          `SMS_PROVIDER=twilio requires: ${smsMissing.join(", ")}`,
        );
      }
    } else if (env.SMS_PROVIDER === "africas_talking") {
      const smsMissing = (["AT_USERNAME", "AT_API_KEY"] as const).filter(
        (k) => !env[k],
      );
      if (smsMissing.length > 0) {
        throw new Error(
          `SMS_PROVIDER=africas_talking requires: ${smsMissing.join(", ")}`,
        );
      }
    }
  }

  return env;
}
