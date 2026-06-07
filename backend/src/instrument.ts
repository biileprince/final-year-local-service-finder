import * as Sentry from "@sentry/nestjs";

// Must be imported before any other module so Sentry's auto-instrumentation
// can patch http/express/prisma at require time. main.ts imports this first.
//
// Sentry stays inert unless SENTRY_DSN is set, so dev/test runs are unaffected.
// The release is tagged with the git SHA: SENTRY_RELEASE is set explicitly in
// CI/build, falling back to HEROKU_SLUG_COMMIT (requires
// `heroku labs:enable runtime-dyno-metadata`).
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE ?? process.env.HEROKU_SLUG_COMMIT,
    tracesSampleRate: 0.1,
  });
}
