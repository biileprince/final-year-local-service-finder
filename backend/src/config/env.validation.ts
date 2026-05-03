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

  // --- Redis (host/port form, matches CacheService) ---
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // --- Auth ---
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be >= 32 chars"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

  // --- Frontend / CORS ---
  FRONTEND_URL: z.url().default("http://localhost:3000"),

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

  // --- Email (SendGrid; required in production) ---
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.email().optional(),
  EMAIL_FROM_NAME: z.string().optional(),

  // --- SMS provider switch + credentials ---
  SMS_PROVIDER: z.enum(["twilio", "africas_talking"]).default("africas_talking"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  AT_USERNAME: z.string().optional(),
  AT_API_KEY: z.string().optional(),
  AT_SHORTCODE: z.string().optional(),

  // --- Sentry (optional) ---
  SENTRY_DSN: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

const PROD_REQUIRED: (keyof Env)[] = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "SENDGRID_API_KEY",
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

    // SMS provider must have its credentials when in prod
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
