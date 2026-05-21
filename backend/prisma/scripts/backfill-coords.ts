/**
 * One-off backfill that gives every active provider a latitude/longitude.
 *
 * Why this exists: the map UI relies on `provider.latitude` + `provider.longitude`
 * to drop a pin. Providers created before the location picker landed (or who
 * skipped it during onboarding) end up with NULL coords, which renders the
 * "No map pin set yet" placeholder on the detail page even when their text
 * location is "Accra, Madina".
 *
 * Strategy: city-prefix match against a small Ghana gazetteer (same as
 * prisma/seed.ts), with a ±0.01° jitter so pins don't stack on the map. Falls
 * back to Accra centre when no city is recognised. Idempotent — skips
 * providers that already have coords.
 *
 * Usage:
 *   npx ts-node prisma/scripts/backfill-coords.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const GH_CITY: Record<string, { lat: number; lng: number }> = {
  Accra: { lat: 5.6037, lng: -0.187 },
  Tema: { lat: 5.6698, lng: 0.0166 },
  Kumasi: { lat: 6.6885, lng: -1.6244 },
  "Cape Coast": { lat: 5.1054, lng: -1.2466 },
  Takoradi: { lat: 4.8845, lng: -1.7554 },
  Tamale: { lat: 9.4035, lng: -0.8424 },
  Ho: { lat: 6.6019, lng: 0.4708 },
  Sunyani: { lat: 7.3392, lng: -2.3265 },
  Koforidua: { lat: 6.0941, lng: -0.2591 },
};

function coordsFor(location: string | null): { lat: number; lng: number } {
  const city = location?.split(",")[0]?.trim() ?? "";
  const base = GH_CITY[city] ?? GH_CITY.Accra!;
  return {
    lat: base.lat + (Math.random() - 0.5) * 0.02,
    lng: base.lng + (Math.random() - 0.5) * 0.02,
  };
}

async function main() {
  const missing = await prisma.provider.findMany({
    where: {
      deletedAt: null,
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: { id: true, location: true },
  });

  console.log(`Found ${missing.length} provider(s) without coordinates.`);

  let updated = 0;
  for (const p of missing) {
    const { lat, lng } = coordsFor(p.location);
    await prisma.provider.update({
      where: { id: p.id },
      data: { latitude: lat, longitude: lng },
    });
    updated += 1;
    console.log(
      `  • ${p.id} (${p.location ?? "no location text"}) → ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    );
  }

  console.log(`Done. Updated ${updated} provider(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
