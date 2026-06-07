-- AlterEnum: add NO_SHOW booking status
ALTER TYPE "BookingStatus" ADD VALUE 'NO_SHOW';

-- CreateEnum: which party failed to show
CREATE TYPE "NoShowParty" AS ENUM ('CUSTOMER', 'PROVIDER');

-- AlterTable: bookings — no-show tracking
ALTER TABLE "bookings" ADD COLUMN "no_show_party" "NoShowParty";
ALTER TABLE "bookings" ADD COLUMN "no_show_reason" TEXT;
ALTER TABLE "bookings" ADD COLUMN "no_show_flagged_at" TIMESTAMP(3);

-- AlterTable: providers — running count of provider-side no-shows (reliability)
ALTER TABLE "providers" ADD COLUMN "no_show_count" INTEGER NOT NULL DEFAULT 0;
