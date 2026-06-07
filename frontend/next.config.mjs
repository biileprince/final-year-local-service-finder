/** @type {import('next').NextConfig} */
const nextConfig = {
  // React Strict Mode for better development experience
  reactStrictMode: true,

  // Enable typed routes (stable in Next.js 15+)
  typescript: {
    // Type-safe routing
  },

  // Turbopack configuration (default dev bundler in Next.js 15+)
  turbopack: {
    // Turbopack-specific options can be added here
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },

  // Security headers
  async headers() {
    const baseHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        // Allow same-origin to request these. `()` means "no origin may
        // use it" — that hard-blocks the geolocation prompt and voice
        // recording, so callers must explicitly opt in. `(self)` keeps
        // third-party iframes locked out but lets the user-prompt fire.
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(self), geolocation=(self)",
      },
    ];

    // HSTS is prod-only on purpose. Setting it in dev would teach the browser
    // to refuse http://localhost for two years after a single prod visit,
    // breaking other local dev work.
    if (process.env.NODE_ENV === "production") {
      baseHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/(.*)", headers: baseHeaders }];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

import { withSentryConfig } from "@sentry/nextjs";

// Sentry build-time wrapper. Source-map upload only runs when SENTRY_AUTH_TOKEN
// + org/project are set in the build env, so local/CI builds without them are
// unaffected. Runtime error reporting is gated separately on
// NEXT_PUBLIC_SENTRY_DSN (see instrumentation-client.ts / sentry.server.config.ts).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Tunnels browser SDK requests through the app to dodge ad-blockers.
  tunnelRoute: "/monitoring",
  // Strip Sentry SDK logger statements to shrink the client bundle.
  disableLogger: true,
});
