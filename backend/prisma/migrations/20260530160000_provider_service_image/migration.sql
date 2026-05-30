-- Add an optional showcase image URL to each provider service offering.
-- Stored as a Cloudinary URL (same source as gallery/avatar uploads) so it can
-- be rendered wherever services are listed.
-- AlterTable
ALTER TABLE "provider_services" ADD COLUMN     "image_url" TEXT;
