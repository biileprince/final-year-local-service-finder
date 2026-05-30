/**
 * Composite Trust Score engine.
 *
 * Implements the five-factor model documented in the project report
 * (Chapter 4, Section 4.6.4, Equation 4.2 and Appendix C). The score fuses
 * subjective review quality with objective, system-recorded provider
 * behaviour and returns a value on a 0–100 scale.
 *
 * Kept as a dependency-free pure function so that it can be unit-tested in
 * isolation and reused by both the recompute path and the test suite.
 *
 *   TrustScore = 100 × (w₁R + w₂C + w₃L + w₄P + w₅V)
 */

/** Normalised platform-mean review quality (≈3.5/5) used for Bayesian damping. */
export const PLATFORM_MEAN_RATING = 0.7;

/** Minimum number of reviews before the review component is fully trusted. */
export const MIN_REVIEWS_FOR_CONFIDENCE = 5;

/** Component weights (Table 4.4). Must sum to 1.0. */
export const TRUST_WEIGHTS = {
  reviewQuality: 0.35, // R — mean star rating, damped
  completion: 0.25, // C — completed ÷ total bookings
  reliability: 0.2, // L — 1 − provider-attributed failures ÷ total
  responsiveness: 0.15, // P — response rate + response-time decay
  verification: 0.05, // V — verified identity + experience
} as const;

export interface TrustScoreInput {
  /** Mean of visible review ratings, on a 0–5 scale. */
  averageRating: number;
  reviewCount: number;
  completedBookings: number;
  totalBookings: number;
  /** Provider-attributed failures (no-shows / provider cancellations). */
  providerCancellations: number;
  /** Message response rate as a percentage, 0–100. */
  responseRate: number;
  avgResponseTimeMinutes: number | null;
  isVerified: boolean;
  yearsExperience: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Compute the composite trust score for a provider. Returns a number in the
 * range 0–100, rounded to one decimal place.
 */
export function computeTrustScore(p: TrustScoreInput): number {
  // --- Component R: review quality (0–1) -----------------------------------
  // Bayesian-damped toward the platform mean so that a provider with only a
  // handful of reviews cannot reach an extreme score on thin evidence.
  const rawR = clamp01(p.averageRating / 5);
  const R =
    (p.reviewCount * rawR + MIN_REVIEWS_FOR_CONFIDENCE * PLATFORM_MEAN_RATING) /
    (p.reviewCount + MIN_REVIEWS_FOR_CONFIDENCE);

  // --- Component C: completion rate (0–1) ----------------------------------
  const C = clamp01(p.completedBookings / Math.max(p.totalBookings, 1));

  // --- Component L: reliability / low cancellation (0–1) -------------------
  const L = clamp01(1 - p.providerCancellations / Math.max(p.totalBookings, 1));

  // --- Component P: responsiveness (0–1) -----------------------------------
  // Blend response rate with an exponential decay on average response time
  // (a one-hour reply scores e⁻¹ ≈ 0.37 on the time factor).
  const timeFactor =
    p.avgResponseTimeMinutes == null
      ? 0
      : Math.exp(-p.avgResponseTimeMinutes / 60);
  const P = clamp01(0.6 * clamp01(p.responseRate / 100) + 0.4 * timeFactor);

  // --- Component V: verification & experience (0–1) ------------------------
  const expFactor = clamp01(p.yearsExperience / 10);
  const V = 0.7 * (p.isVerified ? 1 : 0) + 0.3 * expFactor;

  const score =
    100 *
    (TRUST_WEIGHTS.reviewQuality * R +
      TRUST_WEIGHTS.completion * C +
      TRUST_WEIGHTS.reliability * L +
      TRUST_WEIGHTS.responsiveness * P +
      TRUST_WEIGHTS.verification * V);

  return Math.round(score * 10) / 10;
}
