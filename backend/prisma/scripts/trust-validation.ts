/**
 * Trust-engine validation (Chapter 5, Section 5.7 / Figure 5.5).
 *
 * Builds six provider profiles with deliberately contrasting behaviour and
 * computes BOTH scoring methods for each:
 *   - the static method: a plain star average rescaled to 0–100, and
 *   - the composite method: the production computeTrustScore() engine.
 *
 * It then prints a comparison table. The headline result the report relies on
 * is Provider D — a high star average masking poor completion and frequent
 * no-shows — which scores well under the static method but poorly under the
 * composite one. No database is required.
 *
 * Usage:
 *   npx ts-node prisma/scripts/trust-validation.ts
 */
import {
  computeTrustScore,
  TrustScoreInput,
} from "../../src/modules/providers/trust-score";

interface Profile {
  id: string;
  label: string;
  input: TrustScoreInput;
}

const profiles: Profile[] = [
  {
    id: "A",
    label: "Reliable, verified, experienced",
    input: {
      averageRating: 4.8,
      reviewCount: 42,
      completedBookings: 49,
      totalBookings: 50,
      providerCancellations: 1,
      responseRate: 96,
      avgResponseTimeMinutes: 18,
      isVerified: true,
      yearsExperience: 9,
    },
  },
  {
    id: "B",
    label: "Solid mid-tier provider",
    input: {
      averageRating: 4.2,
      reviewCount: 20,
      completedBookings: 30,
      totalBookings: 35,
      providerCancellations: 3,
      responseRate: 80,
      avgResponseTimeMinutes: 45,
      isVerified: true,
      yearsExperience: 4,
    },
  },
  {
    id: "C",
    label: "New provider, thin history",
    input: {
      averageRating: 5.0,
      reviewCount: 2,
      completedBookings: 2,
      totalBookings: 2,
      providerCancellations: 0,
      responseRate: 100,
      avgResponseTimeMinutes: 30,
      isVerified: false,
      yearsExperience: 1,
    },
  },
  {
    id: "D",
    label: "High rating, poor reliability (the key case)",
    input: {
      averageRating: 4.9,
      reviewCount: 12,
      completedBookings: 10,
      totalBookings: 30,
      providerCancellations: 14,
      responseRate: 40,
      avgResponseTimeMinutes: 240,
      isVerified: false,
      yearsExperience: 1,
    },
  },
  {
    id: "E",
    label: "Consistently reliable, verified",
    input: {
      averageRating: 4.6,
      reviewCount: 60,
      completedBookings: 70,
      totalBookings: 72,
      providerCancellations: 1,
      responseRate: 92,
      avgResponseTimeMinutes: 25,
      isVerified: true,
      yearsExperience: 6,
    },
  },
  {
    id: "F",
    label: "Low rating and unreliable",
    input: {
      averageRating: 2.4,
      reviewCount: 15,
      completedBookings: 8,
      totalBookings: 20,
      providerCancellations: 9,
      responseRate: 35,
      avgResponseTimeMinutes: 300,
      isVerified: false,
      yearsExperience: 2,
    },
  },
];

const staticScore = (avgRating: number) =>
  Math.round((avgRating / 5) * 100 * 10) / 10;

console.log(
  "\nTable 5.x — Static star rating vs composite trust score (0–100 scale)\n",
);
console.log(
  "ID  | Profile                                       | Rating | Static | Composite | Δ",
);
console.log(
  "----+-----------------------------------------------+--------+--------+-----------+-------",
);
for (const p of profiles) {
  const stat = staticScore(p.input.averageRating);
  const comp = computeTrustScore(p.input);
  const delta = Math.round((comp - stat) * 10) / 10;
  console.log(
    `${p.id}   | ${p.label.padEnd(45)} | ${p.input.averageRating.toFixed(1).padStart(6)} | ${stat
      .toFixed(1)
      .padStart(6)} | ${comp.toFixed(1).padStart(9)} | ${delta > 0 ? "+" : ""}${delta}`,
  );
}
console.log(
  "\nObservation: Provider D's static score stays high while its composite score",
);
console.log(
  "collapses, exposing the unreliability a plain star average conceals.\n",
);
