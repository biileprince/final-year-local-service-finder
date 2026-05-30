/**
 * One-off backfill that computes the composite trust score (Section 4.6.4) for
 * every provider from the counters already on their record, and writes it to
 * the new `trustScore` column.
 *
 * Why this exists: the trust_score column was added with a default of 0, so
 * providers created before the engine landed show 0 until their next review or
 * completed booking triggers a recompute. This backfills them all at once so
 * search ranking and profile views reflect real scores immediately. Idempotent
 * — safe to run repeatedly.
 *
 * Usage:
 *   npx ts-node prisma/scripts/backfill-trust-scores.ts
 */
import "dotenv/config";
import { PrismaClient, VerificationStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeTrustScore } from "../../src/modules/providers/trust-score";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const providers = await prisma.provider.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      rating: true,
      reviewCount: true,
      completedBookings: true,
      totalBookings: true,
      noShowCount: true,
      responseRate: true,
      avgResponseTimeMinutes: true,
      verificationStatus: true,
      yearsExperience: true,
    },
  });

  console.log(`Recomputing trust score for ${providers.length} providers...`);
  let updated = 0;
  for (const p of providers) {
    const trustScore = computeTrustScore({
      averageRating: Number(p.rating),
      reviewCount: p.reviewCount,
      completedBookings: p.completedBookings,
      totalBookings: p.totalBookings,
      providerCancellations: p.noShowCount,
      responseRate: Number(p.responseRate),
      avgResponseTimeMinutes: p.avgResponseTimeMinutes,
      isVerified: p.verificationStatus === VerificationStatus.VERIFIED,
      yearsExperience: p.yearsExperience,
    });
    await prisma.provider.update({
      where: { id: p.id },
      data: { trustScore },
    });
    updated += 1;
  }
  console.log(`Done. Updated ${updated} providers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
