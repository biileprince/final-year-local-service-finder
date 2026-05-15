-- Full-text + fuzzy search via pg_trgm (trigram similarity).
-- Lets us rank results by similarity() on free-text fields and survive
-- typos / partial words ("plumb" → "Plumbing"). GIN indexes on the
-- gin_trgm_ops opclass make `ILIKE`, `%`, and similarity() fast.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Provider profile text
CREATE INDEX IF NOT EXISTS "providers_bio_trgm_idx"
  ON "providers" USING GIN ("bio" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "providers_location_trgm_idx"
  ON "providers" USING GIN ("location" gin_trgm_ops);

-- User names (provider display name)
CREATE INDEX IF NOT EXISTS "users_name_trgm_idx"
  ON "users" USING GIN ("name" gin_trgm_ops);

-- Categories (browse + suggest)
CREATE INDEX IF NOT EXISTS "categories_name_trgm_idx"
  ON "categories" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "categories_description_trgm_idx"
  ON "categories" USING GIN ("description" gin_trgm_ops);

-- Specialties — typeahead's most useful field
CREATE INDEX IF NOT EXISTS "provider_specialties_specialty_trgm_idx"
  ON "provider_specialties" USING GIN ("specialty" gin_trgm_ops);

-- Cheap geo-radius pre-filter (bounding box). Real distance is computed in
-- SQL via the Haversine formula; this index just narrows the candidate set.
CREATE INDEX IF NOT EXISTS "providers_lat_lng_idx"
  ON "providers" ("latitude", "longitude");

-- Hot-listing index: active+verified providers sorted by rating. Speeds up
-- the default /search/providers query when no text query is supplied.
CREATE INDEX IF NOT EXISTS "providers_active_rating_idx"
  ON "providers" ("is_active", "verification_status", "rating" DESC)
  WHERE "deleted_at" IS NULL;
