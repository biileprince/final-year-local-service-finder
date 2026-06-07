-- Customer-facing "save provider" feature. One row per (user, provider) pair.
-- ON DELETE CASCADE on both FKs so favorites disappear cleanly when a user
-- closes their account or a provider is hard-deleted.
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "favorites_user_id_provider_id_key"
    ON "favorites"("user_id", "provider_id");

CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");
CREATE INDEX "favorites_provider_id_idx" ON "favorites"("provider_id");

ALTER TABLE "favorites"
    ADD CONSTRAINT "favorites_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "favorites"
    ADD CONSTRAINT "favorites_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
