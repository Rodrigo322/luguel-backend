DO $$ BEGIN
  CREATE TYPE "RentalPaymentMode" AS ENUM ('IN_APP_FULL', 'SPLIT_SIGNAL_REMAINDER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RentalPaymentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RentalFulfillmentMethod" AS ENUM ('PICKUP_LOCAL', 'DELIVERY_PARTNER', 'DELIVERY_OWNER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IdentityVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PREMIUM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PremiumSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "identityVerificationStatus" "IdentityVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "identityVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "plan" "UserPlan" NOT NULL DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3);

ALTER TABLE "Rental"
  ADD COLUMN IF NOT EXISTS "fulfillmentMethod" "RentalFulfillmentMethod" NOT NULL DEFAULT 'PICKUP_LOCAL',
  ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "platformFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "signalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "remainderAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "UserIdentityVerification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentNumberHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "birthDate" TIMESTAMP(3) NOT NULL,
  "status" "IdentityVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserIdentityVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserIdentityVerification_userId_key"
ON "UserIdentityVerification"("userId");

DO $$ BEGIN
  ALTER TABLE "UserIdentityVerification"
    ADD CONSTRAINT "UserIdentityVerification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PremiumSubscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "PremiumSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "amount" DECIMAL(10,2) NOT NULL,
  "months" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PremiumSubscription_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PremiumSubscription_userId_createdAt_idx"
ON "PremiumSubscription"("userId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "PremiumSubscription"
    ADD CONSTRAINT "PremiumSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RentalPayment" (
  "id" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "mode" "RentalPaymentMode" NOT NULL,
  "status" "RentalPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "platformFeeAmount" DECIMAL(10,2) NOT NULL,
  "depositAmount" DECIMAL(10,2) NOT NULL,
  "signalAmount" DECIMAL(10,2) NOT NULL,
  "remainderAmount" DECIMAL(10,2) NOT NULL,
  "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "inAppPaymentReference" TEXT,
  "proofUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RentalPayment_rentalId_key"
ON "RentalPayment"("rentalId");

DO $$ BEGIN
  ALTER TABLE "RentalPayment"
    ADD CONSTRAINT "RentalPayment_rentalId_fkey"
    FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RentalContract" (
  "id" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "contractText" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "acceptedByTenantAt" TIMESTAMP(3),
  "acceptedByOwnerAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RentalContract_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RentalContract_rentalId_key"
ON "RentalContract"("rentalId");

DO $$ BEGIN
  ALTER TABLE "RentalContract"
    ADD CONSTRAINT "RentalContract_rentalId_fkey"
    FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RentalReceipt" (
  "id" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "receiptNumber" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentalReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RentalReceipt_rentalId_key"
ON "RentalReceipt"("rentalId");

CREATE UNIQUE INDEX IF NOT EXISTS "RentalReceipt_receiptNumber_key"
ON "RentalReceipt"("receiptNumber");

DO $$ BEGIN
  ALTER TABLE "RentalReceipt"
    ADD CONSTRAINT "RentalReceipt_rentalId_fkey"
    FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RentalChatMessage" (
  "id" TEXT NOT NULL,
  "rentalId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RentalChatMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RentalChatMessage_rentalId_createdAt_idx"
ON "RentalChatMessage"("rentalId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "RentalChatMessage"
    ADD CONSTRAINT "RentalChatMessage_rentalId_fkey"
    FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "RentalChatMessage"
    ADD CONSTRAINT "RentalChatMessage_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

