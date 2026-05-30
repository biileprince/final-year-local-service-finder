import type { Metadata } from "next";
import { buildSiteKeywords } from "@/lib/seo";

// The search page is a client component, so per-page metadata lives here.
export const metadata: Metadata = {
  title: "Find Local Service Providers Near You in Ghana",
  description:
    "Search verified plumbers, electricians, cleaners, carpenters, mechanics, hairdressers and more across Ghana. Filter by location, category, rating, and distance, then book in minutes.",
  keywords: buildSiteKeywords(),
  alternates: { canonical: "/search" },
  openGraph: {
    title: "Find local service providers in Ghana",
    description:
      "Search verified plumbers, electricians, cleaners, and more across Ghana.",
    url: "/search",
  },
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
