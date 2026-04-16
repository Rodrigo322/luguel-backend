import {
  ensureListingCanBeEdited,
  ensureListingWriteAccess,
  ensureValidDailyPrice,
  resolveListingStatusFromRisk
} from "../../domain/listings/services/listing-rules";
import { DomainError } from "../../domain/shared/errors/domain-error";
import { assessListingRisk } from "../../domain/shared/risk/risk-assessor";
import {
  createReportRecord,
  createRiskAssessmentRecord,
  getListingById,
  getUserById,
  updateListingRecord
} from "../../infra/persistence/in-memory-store";
import type { UserRole } from "../../shared/types/role";

interface UpdateListingInput {
  requesterId: string;
  requesterRole: UserRole;
  listingId: string;
  title?: string;
  description?: string;
  dailyPrice?: number;
}

export async function updateListing(input: UpdateListingInput) {
  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureListingWriteAccess({
    actorId: input.requesterId,
    actorRole: input.requesterRole,
    ownerId: listing.ownerId
  });

  ensureListingCanBeEdited(listing.status);

  const owner = await getUserById(listing.ownerId);

  if (!owner) {
    throw new DomainError("Listing owner was not found.", 404, "OwnerNotFound");
  }

  const hasUpdates =
    input.title !== undefined || input.description !== undefined || input.dailyPrice !== undefined;

  if (!hasUpdates) {
    throw new DomainError("At least one listing field must be informed.", 400, "NoListingFieldsToUpdate");
  }

  if (input.dailyPrice !== undefined) {
    ensureValidDailyPrice(input.dailyPrice);
  }

  const title = input.title ?? listing.title;
  const description = input.description ?? listing.description;
  const dailyPrice = input.dailyPrice ?? listing.dailyPrice;

  const risk = assessListingRisk({
    title,
    description,
    dailyPrice,
    ownerReputationScore: owner.reputationScore
  });

  const updatedListing = await updateListingRecord(listing.id, {
    title,
    description,
    dailyPrice,
    riskLevel: risk.level,
    status: resolveListingStatusFromRisk(risk.level)
  });

  if (!updatedListing) {
    throw new DomainError("Unable to update listing.", 500, "ListingUpdateFailed");
  }

  await createRiskAssessmentRecord({
    userId: owner.id,
    listingId: updatedListing.id,
    score: risk.score,
    level: risk.level,
    reasons: risk.reasons
  });

  if (risk.level === "CRITICAL") {
    await createReportRecord({
      reporterId: owner.id,
      listingId: updatedListing.id,
      reason: "Automatic risk screening detected critical listing risk after update.",
      details: risk.reasons.join(" | "),
      riskLevel: "CRITICAL",
      status: "OPEN"
    });
  }

  return {
    listing: updatedListing,
    risk
  };
}
