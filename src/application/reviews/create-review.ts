import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  createReviewRecord,
  findReviewByRentalAndReviewer,
  getListingById,
  getRentalById
} from "../../infra/persistence/in-memory-store";

interface CreateReviewInput {
  reviewerId: string;
  rentalId: string;
  listingId: string;
  rating: number;
  comment?: string;
}

export function createReview(input: CreateReviewInput) {
  if (input.rating < 1 || input.rating > 5) {
    throw new DomainError("Rating must be between 1 and 5.", 400, "InvalidRating");
  }

  const rental = getRentalById(input.rentalId);

  if (!rental) {
    throw new DomainError("Rental not found.", 404, "RentalNotFound");
  }

  if (rental.status !== "COMPLETED") {
    throw new DomainError("Review can only be created for completed rentals.", 400, "RentalNotCompleted");
  }

  const listing = getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  if (listing.id !== rental.listingId) {
    throw new DomainError("Listing and rental mismatch.", 400, "ListingRentalMismatch");
  }

  const reviewerIsTenant = rental.tenantId === input.reviewerId;
  const reviewerIsOwner = listing.ownerId === input.reviewerId;

  if (!reviewerIsTenant && !reviewerIsOwner) {
    throw new DomainError("Reviewer is not part of the rental.", 403, "ReviewForbidden");
  }

  const existing = findReviewByRentalAndReviewer(rental.id, input.reviewerId);

  if (existing) {
    throw new DomainError("Review already exists for this rental and reviewer.", 409, "ReviewAlreadyExists");
  }

  const reviewedId = reviewerIsTenant ? listing.ownerId : rental.tenantId;

  return createReviewRecord({
    listingId: listing.id,
    rentalId: rental.id,
    reviewerId: input.reviewerId,
    reviewedId,
    rating: input.rating,
    comment: input.comment
  });
}
