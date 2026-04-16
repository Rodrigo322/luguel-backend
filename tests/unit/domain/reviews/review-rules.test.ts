import { describe, expect, it } from "vitest";
import {
  ensureListingMatchesRental,
  ensureRentalCompletedForReview,
  ensureValidReviewRating,
  resolveReviewedUserId
} from "../../../../src/domain/reviews/services/review-rules";

describe("review-rules", () => {
  it("should validate rating and completed rental", () => {
    expect(() => ensureValidReviewRating(0)).toThrowError(/Rating/);
    expect(() => ensureRentalCompletedForReview("ACTIVE")).toThrowError(/completed rentals/);
  });

  it("should validate listing-rental association", () => {
    expect(() => ensureListingMatchesRental("listing-1", "listing-2")).toThrowError(/mismatch/);
  });

  it("should resolve reviewed user from tenant or owner", () => {
    expect(
      resolveReviewedUserId({
        reviewerId: "tenant",
        tenantId: "tenant",
        ownerId: "owner"
      })
    ).toBe("owner");

    expect(() =>
      resolveReviewedUserId({
        reviewerId: "outsider",
        tenantId: "tenant",
        ownerId: "owner"
      })
    ).toThrowError(/not part of the rental/);
  });
});
