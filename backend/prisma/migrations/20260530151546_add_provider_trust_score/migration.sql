-- Add the persisted composite trust score (Section 4.6.4, Equation 4.2).
-- 0–100 scale, one decimal place, recomputed on every review/booking change.
-- AlterTable
ALTER TABLE "providers" ADD COLUMN     "trust_score" DECIMAL(4,1) NOT NULL DEFAULT 0;

-- CreateIndex: sort providers by trust score for the TRUST sort and as the
-- quality tiebreaker in the default relevance ranking.
CREATE INDEX "providers_trust_score_idx" ON "providers"("trust_score" DESC);

-- NOTE: The pg_trgm / lat-lng search indexes below are created with raw SQL in
-- the 20260515010000_search_indexes migration and are intentionally NOT
-- declared in schema.prisma. Prisma therefore reports them as drift on every
-- `migrate dev` and tries to DROP them. We re-create them here (idempotent) so
-- that applying this migration never degrades search/geo performance.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "providers_bio_trgm_idx"
  ON "providers" USING GIN ("bio" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "providers_location_trgm_idx"
  ON "providers" USING GIN ("location" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "users_name_trgm_idx"
  ON "users" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "categories_name_trgm_idx"
  ON "categories" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "categories_description_trgm_idx"
  ON "categories" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "provider_specialties_specialty_trgm_idx"
  ON "provider_specialties" USING GIN ("specialty" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "providers_lat_lng_idx"
  ON "providers" ("latitude", "longitude");
