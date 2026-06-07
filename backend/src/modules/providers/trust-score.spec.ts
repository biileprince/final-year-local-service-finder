import {
  computeTrustScore,
  TrustScoreInput,
  TRUST_WEIGHTS,
  PLATFORM_MEAN_RATING,
} from "./trust-score";

/**
 * Unit tests for the composite Trust Score engine (Chapter 4, Section 4.6.4).
 * These run without a database and validate Equation 4.2 and the
 * discrimination behaviour evaluated in Section 5.7.
 */

// A baseline reliable provider: strong rating, near-perfect completion, no
// no-shows, responsive, verified, experienced.
const reliable = (): TrustScoreInput => ({
  averageRating: 4.8,
  reviewCount: 40,
  completedBookings: 48,
  totalBookings: 50,
  providerCancellations: 1,
  responseRate: 95,
  avgResponseTimeMinutes: 20,
  isVerified: true,
  yearsExperience: 8,
});

describe("computeTrustScore", () => {
  it("uses weights that sum to 1.0", () => {
    const sum =
      TRUST_WEIGHTS.reviewQuality +
      TRUST_WEIGHTS.completion +
      TRUST_WEIGHTS.reliability +
      TRUST_WEIGHTS.responsiveness +
      TRUST_WEIGHTS.verification;
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("returns a value on the 0–100 scale", () => {
    const score = computeTrustScore(reliable());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores a consistently reliable, verified provider highly", () => {
    expect(computeTrustScore(reliable())).toBeGreaterThan(85);
  });

  it("never exceeds 100 even with perfect inputs", () => {
    const perfect: TrustScoreInput = {
      averageRating: 5,
      reviewCount: 1000,
      completedBookings: 100,
      totalBookings: 100,
      providerCancellations: 0,
      responseRate: 100,
      avgResponseTimeMinutes: 0,
      isVerified: true,
      yearsExperience: 20,
    };
    expect(computeTrustScore(perfect)).toBeLessThanOrEqual(100);
  });

  it("never drops below 0 for the worst-case provider", () => {
    const worst: TrustScoreInput = {
      averageRating: 0,
      reviewCount: 0,
      completedBookings: 0,
      totalBookings: 50,
      providerCancellations: 50,
      responseRate: 0,
      avgResponseTimeMinutes: 600,
      isVerified: false,
      yearsExperience: 0,
    };
    expect(computeTrustScore(worst)).toBeGreaterThanOrEqual(0);
  });

  // The central claim of Section 5.7: the composite score must expose a
  // provider whose high star average hides poor reliability.
  it("ranks an unreliable five-star provider below a reliable one", () => {
    const reliableScore = computeTrustScore(reliable());

    // Provider "D" from the report: high rating, but poor completion and
    // frequent cancellations.
    const unreliableButHighlyRated: TrustScoreInput = {
      averageRating: 4.9,
      reviewCount: 12,
      completedBookings: 10,
      totalBookings: 30,
      providerCancellations: 14,
      responseRate: 40,
      avgResponseTimeMinutes: 240,
      isVerified: false,
      yearsExperience: 1,
    };
    const unreliableScore = computeTrustScore(unreliableButHighlyRated);

    expect(unreliableScore).toBeLessThan(reliableScore);
    // A static star average would rate it ~98/100; the composite must not.
    expect(unreliableScore).toBeLessThan(65);
  });

  it("damps a tiny-sample rating toward the platform mean (Bayesian)", () => {
    const oneGreatReview = computeTrustScore({
      ...reliable(),
      averageRating: 5,
      reviewCount: 1,
    });
    const manyGreatReviews = computeTrustScore({
      ...reliable(),
      averageRating: 5,
      reviewCount: 500,
    });
    // With identical behaviour otherwise, more evidence yields a higher score
    // because the review component is no longer pulled toward the mean.
    expect(manyGreatReviews).toBeGreaterThan(oneGreatReview);
  });

  it("treats a brand-new provider with no history at the damped baseline", () => {
    const fresh: TrustScoreInput = {
      averageRating: 0,
      reviewCount: 0,
      completedBookings: 0,
      totalBookings: 0,
      providerCancellations: 0,
      responseRate: 0,
      avgResponseTimeMinutes: null,
      isVerified: false,
      yearsExperience: 0,
    };
    // R damped fully to the platform mean, C=0, L=1 (no failures yet), P=0, V=0.
    const expected =
      100 *
      (TRUST_WEIGHTS.reviewQuality * PLATFORM_MEAN_RATING +
        TRUST_WEIGHTS.reliability * 1);
    expect(computeTrustScore(fresh)).toBeCloseTo(
      Math.round(expected * 10) / 10,
      1,
    );
  });

  it("rewards verification and penalises provider no-shows", () => {
    const base = reliable();
    const verified = computeTrustScore({ ...base, isVerified: true });
    const unverified = computeTrustScore({ ...base, isVerified: false });
    expect(verified).toBeGreaterThan(unverified);

    const noNoShows = computeTrustScore({ ...base, providerCancellations: 0 });
    const manyNoShows = computeTrustScore({
      ...base,
      providerCancellations: 20,
    });
    expect(noNoShows).toBeGreaterThan(manyNoShows);
  });

  it("handles a null average response time without producing NaN", () => {
    const score = computeTrustScore({
      ...reliable(),
      avgResponseTimeMinutes: null,
    });
    expect(Number.isNaN(score)).toBe(false);
  });
});
