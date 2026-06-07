import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep authenticated / transactional areas out of the index.
      disallow: [
        "/dashboard",
        "/admin",
        "/analytics",
        "/availability",
        "/bookings",
        "/favorites",
        "/messages",
        "/notifications",
        "/profile",
        "/services",
        "/settings",
        "/onboarding",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
