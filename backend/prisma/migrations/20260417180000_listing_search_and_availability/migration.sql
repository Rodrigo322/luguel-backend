-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ListingDeliveryMode" AS ENUM ('PICKUP', 'DELIVERY', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ListingBookingMode" AS ENUM ('IMMEDIATE', 'SCHEDULED', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ListingAvailabilityStatus" AS ENUM ('FREE', 'BLOCKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "deliveryMode" "ListingDeliveryMode" NOT NULL DEFAULT 'BOTH';
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "bookingMode" "ListingBookingMode" NOT NULL DEFAULT 'BOTH';

-- CreateTable
CREATE TABLE IF NOT EXISTS "ListingAvailabilitySlot" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "status" "ListingAvailabilityStatus" NOT NULL,
  "pickupTime" TEXT,
  "returnTime" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ListingAvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ListingAvailabilitySlot_listingId_date_key" ON "ListingAvailabilitySlot"("listingId", "date");
CREATE INDEX IF NOT EXISTS "ListingAvailabilitySlot_listingId_date_idx" ON "ListingAvailabilitySlot"("listingId", "date");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ListingAvailabilitySlot"
    ADD CONSTRAINT "ListingAvailabilitySlot_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
