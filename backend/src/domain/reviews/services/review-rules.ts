import { DomainError } from "../../shared/errors/domain-error";
import type { RentalStatus } from "../../rentals/entities/rental";

export function ensureValidReviewRating(rating: number): void {
  if (rating < 1 || rating > 5) {
    throw new DomainError("Rating must be between 1 and 5.", 400, "InvalidRating");
  }
}

export function ensureRentalCompletedForReview(rentalStatus: RentalStatus): void {
  if (rentalStatus !== "COMPLETED") {
    throw new DomainError("Review can only be created for completed rentals.", 400, "RentalNotCompleted");
  }
}

export function ensureListingMatchesRental(listingId: string, rentalListingId: string): void {
  if (listingId !== rentalListingId) {
    throw new DomainError("Listing and rental mismatch.", 400, "ListingRentalMismatch");
  }
}

export function resolveReviewedUserId(input: {
  reviewerId: string;
  tenantId: string;
  ownerId: string;
}): string {
  const reviewerIsTenant = input.tenantId === input.reviewerId;
  const reviewerIsOwner = input.ownerId === input.reviewerId;

  if (!reviewerIsTenant && !reviewerIsOwner) {
    throw new DomainError("Reviewer is not part of the rental.", 403, "ReviewForbidden");
  }

  return reviewerIsTenant ? input.ownerId : input.tenantId;
}
