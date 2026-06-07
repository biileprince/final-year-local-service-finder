import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { JsonLd } from "@/components/seo/json-ld";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Organization + WebSite structured data. The WebSite SearchAction lets Google
// show a sitelinks search box for the brand.
const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Local Service Finder",
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-192.png`,
  description:
    "Connect with verified local service providers in Ghana. Book plumbers, electricians, cleaners, and more.",
  areaServed: { "@type": "Country", name: "Ghana" },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Local Service Finder",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={orgJsonLd} />
      <JsonLd data={websiteJsonLd} />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
