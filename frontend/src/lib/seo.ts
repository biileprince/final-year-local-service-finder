/**
 * Central SEO keyword sets for Local Service Finder.
 *
 * Reality check: the <meta keywords> tag is ignored by Google and most engines,
 * so these lists are NOT a ranking lever on their own. What actually ranks a
 * directory like this is: descriptive titles/H1s, useful descriptions, valid
 * structured data (we emit Organization/WebSite/ProfessionalService + ratings),
 * fast pages, crawlable links, and real content per provider/category. These
 * sets exist so titles, descriptions, and per-page keyword hints stay
 * consistent and cover the language Ghanaian users actually search with.
 */

// The trades/services people search for. Kept in the words users type
// ("AC repair", "house help") rather than formal category names.
export const SERVICE_KEYWORDS = [
  "plumber",
  "electrician",
  "cleaner",
  "house cleaning",
  "carpenter",
  "painter",
  "mason",
  "tiler",
  "welder",
  "mechanic",
  "auto mechanic",
  "AC repair",
  "air conditioner repair",
  "fridge repair",
  "washing machine repair",
  "generator repair",
  "appliance repair",
  "POP ceiling installer",
  "aluminium fabricator",
  "interior decorator",
  "gardener",
  "landscaper",
  "pest control",
  "fumigation",
  "borehole drilling",
  "solar installer",
  "CCTV installer",
  "security services",
  "handyman",
  "hairdresser",
  "barber",
  "makeup artist",
  "nail technician",
  "tailor",
  "seamstress",
  "fashion designer",
  "caterer",
  "event decorator",
  "photographer",
  "videographer",
  "DJ",
  "MC",
  "driver",
  "dispatch rider",
  "movers",
  "haulage",
  "laundry",
  "dry cleaning",
  "house help",
  "nanny",
  "cook",
  "tutor",
  "fitness trainer",
] as const;

// Major Ghanaian towns/cities people add to a service query.
export const LOCATION_KEYWORDS = [
  "Ghana",
  "Accra",
  "Kumasi",
  "Tema",
  "Takoradi",
  "Tamale",
  "Cape Coast",
  "Sunyani",
  "Koforidua",
  "Ho",
  "Wa",
  "Bolgatanga",
  "Sekondi",
  "Ashaiman",
  "Madina",
  "Tarkwa",
  "Obuasi",
  "Techiman",
  "Kasoa",
  "East Legon",
] as const;

// Intent/qualifier words that ride alongside a service ("plumber near me").
export const INTENT_KEYWORDS = [
  "near me",
  "book online",
  "hire",
  "verified",
  "trusted",
  "affordable",
  "local services",
  "home services",
  "artisan",
  "service providers",
  "find a professional",
  "same day",
] as const;

/**
 * A broad but deduplicated keyword list for the site-wide <head>. Combines the
 * core trades, top cities, and intent words plus a handful of high-value
 * "{service} in Accra/Kumasi" long-tail phrases.
 */
export function buildSiteKeywords(): string[] {
  const longTail = [
    "plumber in Accra",
    "electrician in Accra",
    "cleaner in Accra",
    "plumber in Kumasi",
    "electrician in Kumasi",
    "AC repair Accra",
    "home services Ghana",
    "local artisans Ghana",
    "book a handyman in Ghana",
  ];
  return Array.from(
    new Set([
      ...SERVICE_KEYWORDS,
      ...INTENT_KEYWORDS,
      ...LOCATION_KEYWORDS,
      ...longTail,
    ]),
  );
}

/**
 * Major Ghanaian cities we build dedicated "{category} in {city}" landing
 * pages for. Slugs are URL segments; names are the human label and the value
 * sent to the search API's `location` filter.
 */
export const CITIES = [
  { name: "Accra", slug: "accra" },
  { name: "Kumasi", slug: "kumasi" },
  { name: "Tema", slug: "tema" },
  { name: "Takoradi", slug: "takoradi" },
  { name: "Tamale", slug: "tamale" },
  { name: "Cape Coast", slug: "cape-coast" },
  { name: "Koforidua", slug: "koforidua" },
  { name: "Sunyani", slug: "sunyani" },
  { name: "Ho", slug: "ho" },
  { name: "Kasoa", slug: "kasoa" },
] as const;

export type City = (typeof CITIES)[number];

export function findCityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}

/**
 * Per-provider keyword hints derived from their category and location, e.g.
 * ["plumber", "plumber in Tema", "plumber near me", "Tema"].
 */
export function buildProviderKeywords(
  category: string | undefined,
  location: string | undefined,
): string[] {
  const out: string[] = ["local services", "Ghana", "verified", "book online"];
  const cat = category?.trim();
  const loc = location?.trim();
  if (cat) {
    out.push(cat, `${cat} near me`);
    if (loc) out.push(`${cat} in ${loc}`);
  }
  if (loc) out.push(loc);
  return Array.from(new Set(out));
}
