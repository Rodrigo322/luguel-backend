import { DomainError } from "../../domain/shared/errors/domain-error";
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
  dailyPrice: number;
}

export function createListing(input: CreateListingInput) {
  const owner = getUserById(input.ownerId);

  if (!owner) {
    throw new DomainError("Listing owner was not found.", 404, "OwnerNotFound");
  }

  if (input.dailyPrice <= 0) {
    throw new DomainError("Daily price must be greater than zero.", 400, "InvalidDailyPrice");
  }

  const risk = assessListingRisk({
    title: input.title,
    description: input.description,
    dailyPrice: input.dailyPrice,
    ownerReputationScore: owner.reputationScore
  });

  const listing = createListingRecord({
    ownerId: owner.id,
    title: input.title,
    description: input.description,
    dailyPrice: input.dailyPrice,
    riskLevel: risk.level,
    status: risk.level === "CRITICAL" ? "FLAGGED" : "ACTIVE"
  });

  createRiskAssessmentRecord({
    userId: owner.id,
    listingId: listing.id,
    score: risk.score,
    level: risk.level,
    reasons: risk.reasons
  });

  if (risk.level === "CRITICAL") {
    createReportRecord({
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
