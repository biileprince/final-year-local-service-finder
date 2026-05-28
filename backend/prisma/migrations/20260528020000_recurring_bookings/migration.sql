-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- AlterTable: bookings — link a generated instance back to its series
ALTER TABLE "bookings" ADD COLUMN "recurring_booking_id" TEXT;

-- CreateTable: recurring_bookings (series template)
CREATE TABLE "recurring_bookings" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "scheduled_start_time" TIME,
    "scheduled_end_time" TIME,
    "service_address" TEXT NOT NULL,
    "service_latitude" DECIMAL(10,8),
    "service_longitude" DECIMAL(11,8),
    "problem_description" TEXT NOT NULL,
    "estimated_amount" DECIMAL(10,2),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "max_occurrences" INTEGER,
    "occurrences_created" INTEGER NOT NULL DEFAULT 0,
    "next_occurrence_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_recurring_booking_id_idx" ON "bookings"("recurring_booking_id");
CREATE INDEX "recurring_bookings_customer_id_idx" ON "recurring_bookings"("customer_id");
CREATE INDEX "recurring_bookings_provider_id_idx" ON "recurring_bookings"("provider_id");
CREATE INDEX "recurring_bookings_is_active_next_occurrence_date_idx" ON "recurring_bookings"("is_active", "next_occurrence_date");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_recurring_booking_id_fkey"
    FOREIGN KEY ("recurring_booking_id") REFERENCES "recurring_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recurring_bookings" ADD CONSTRAINT "recurring_bookings_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_bookings" ADD CONSTRAINT "recurring_bookings_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
