import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  ensureListingMatchesRental,
  ensureRentalCompletedForReview,
  ensureValidReviewRating,
  resolveReviewedUserId
} from "../../domain/reviews/services/review-rules";
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

export async function createReview(input: CreateReviewInput) {
  ensureValidReviewRating(input.rating);

  const rental = await getRentalById(input.rentalId);

  if (!rental) {
    throw new DomainError("Rental not found.", 404, "RentalNotFound");
  }

  ensureRentalCompletedForReview(rental.status);

  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureListingMatchesRental(listing.id, rental.listingId);

  const existing = await findReviewByRentalAndReviewer(rental.id, input.reviewerId);

  if (existing) {
    throw new DomainError("Review already exists for this rental and reviewer.", 409, "ReviewAlreadyExists");
  }

  const reviewedId = resolveReviewedUserId({
    reviewerId: input.reviewerId,
    tenantId: rental.tenantId,
    ownerId: listing.ownerId
  });

  return createReviewRecord({
    listingId: listing.id,
    rentalId: rental.id,
    reviewerId: input.reviewerId,
    reviewedId,
    rating: input.rating,
    comment: input.comment
  });
}
