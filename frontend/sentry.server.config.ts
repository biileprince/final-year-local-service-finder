import * as Sentry from "@sentry/nextjs";

// Server-side (Node runtime) Sentry init. No-op unless NEXT_PUBLIC_SENTRY_DSN
// is set. Release is tagged with the git SHA via SENTRY_RELEASE, set at build.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
  });
}
