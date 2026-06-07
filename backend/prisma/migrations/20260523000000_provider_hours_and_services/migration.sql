-- CreateTable: provider_hours
CREATE TABLE "provider_hours" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_minutes" INTEGER NOT NULL DEFAULT 540,
    "close_minutes" INTEGER NOT NULL DEFAULT 1020,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable: provider_services
CREATE TABLE "provider_services" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name" TEXT NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "duration_min" INTEGER NOT NULL DEFAULT 60,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_hours_provider_id_day_of_week_key" ON "provider_hours"("provider_id", "day_of_week");
CREATE INDEX "provider_hours_provider_id_idx" ON "provider_hours"("provider_id");
CREATE INDEX "provider_services_provider_id_idx" ON "provider_services"("provider_id");
CREATE INDEX "provider_services_provider_id_is_active_idx" ON "provider_services"("provider_id", "is_active");

-- AddForeignKey
ALTER TABLE "provider_hours" ADD CONSTRAINT "provider_hours_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_services" ADD CONSTRAINT "provider_services_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
