import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  ensureValidDailyPrice,
  resolveListingStatusFromRisk
} from "../../domain/listings/services/listing-rules";
import {
  ensureValidListingBookingMode,
  ensureValidListingCategory,
  ensureValidListingCity,
  ensureValidListingDeliveryMode,
  ensureValidListingRegion
} from "../../domain/listings/services/listing-availability-rules";
import { assessListingRisk } from "../../domain/shared/risk/risk-assessor";
import {
  createListingRecord,
  createReportRecord,
  createRiskAssessmentRecord,
  getUserById
} from "../../infra/persistence/in-memory-store";

interface CreateListingInput {
  ownerId: string;
  title: string;
  description: string;
  category?: string;
  city?: string;
  region?: string;
  dailyPrice: number;
  deliveryMode?: "PICKUP" | "DELIVERY" | "BOTH";
  bookingMode?: "IMMEDIATE" | "SCHEDULED" | "BOTH";
}

export async function createListing(input: CreateListingInput) {
  const owner = await getUserById(input.ownerId);

  if (!owner) {
    throw new DomainError("Listing owner was not found.", 404, "OwnerNotFound");
  }

  if (owner.isBanned) {
    throw new DomainError("Banned user cannot create listings.", 403, "BannedUserForbidden");
  }

  ensureValidDailyPrice(input.dailyPrice);
  const category = ensureValidListingCategory(input.category);
  const city = ensureValidListingCity(input.city);
  const region = ensureValidListingRegion(input.region);
  const deliveryMode = ensureValidListingDeliveryMode(input.deliveryMode);
  const bookingMode = ensureValidListingBookingMode(input.bookingMode);

  const risk = assessListingRisk({
    title: input.title,
    description: input.description,
    dailyPrice: input.dailyPrice,
    ownerReputationScore: owner.reputationScore
  });

  const listing = await createListingRecord({
    ownerId: owner.id,
    title: input.title,
    description: input.description,
    category,
    city,
    region,
    dailyPrice: input.dailyPrice,
    deliveryMode,
    bookingMode,
    riskLevel: risk.level,
    status: resolveListingStatusFromRisk(risk.level)
  });

  await createRiskAssessmentRecord({
    userId: owner.id,
    listingId: listing.id,
    score: risk.score,
    level: risk.level,
    reasons: risk.reasons
  });

  if (risk.level === "CRITICAL") {
    await createReportRecord({
      reporterId: owner.id,
      listingId: listing.id,
      reason: "Automatic risk screening detected critical listing risk.",
      details: risk.reasons.join(" | "),
      riskLevel: "CRITICAL",
      status: "OPEN"
    });
  }

  return {
    listing,
    risk
  };
}
