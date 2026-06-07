-- AlterTable: providers — add informational free-text cancellation policy
-- shown to customers at booking time. No fee/window logic (payments are
-- offline-only).
ALTER TABLE "providers" ADD COLUMN "cancellation_policy" TEXT;
