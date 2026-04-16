import { beforeEach, describe, expect, it } from "vitest";
import { createReview } from "../../../../src/application/reviews/create-review";
import {
  createListingRecord,
  createRentalRecord,
  getUserById,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

async function setupCompletedRental() {
  const owner = await upsertUserFromAuth({
    id: "owner-review",
    email: "owner-review@example.com",
    name: "Owner Review"
  });
  const tenant = await upsertUserFromAuth({
    id: "tenant-review",
    email: "tenant-review@example.com",
    name: "Tenant Review"
  });

  const listing = await createListingRecord({
    ownerId: owner.id,
    title: "Apartamento review",
    description: "Descricao valida para locacao.",
    dailyPrice: 220,
    riskLevel: "LOW",
    status: "ACTIVE"
  });

  const rental = await createRentalRecord({
    listingId: listing.id,
    tenantId: tenant.id,
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: new Date("2026-06-04T00:00:00.000Z"),
    totalPrice: 660,
    status: "COMPLETED"
  });

  return { owner, tenant, listing, rental };
}

describe("createReview", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should reject invalid rating values", async () => {
    const { tenant, listing, rental } = await setupCompletedRental();

    await expect(
      createReview({
        reviewerId: tenant.id,
        listingId: listing.id,
        rentalId: rental.id,
        rating: 0
      })
    ).rejects.toMatchObject({
      code: "InvalidRating"
    });
  });

  it("should reject duplicated review for same rental and reviewer", async () => {
    const { tenant, listing, rental } = await setupCompletedRental();

    await createReview({
      reviewerId: tenant.id,
      listingId: listing.id,
      rentalId: rental.id,
      rating: 5
    });

    await expect(
      createReview({
        reviewerId: tenant.id,
        listingId: listing.id,
        rentalId: rental.id,
        rating: 4
      })
    ).rejects.toMatchObject({
      code: "ReviewAlreadyExists"
    });
  });

  it("should update reviewed user reputation when review is created", async () => {
    const { owner, tenant, listing, rental } = await setupCompletedRental();

    await createReview({
      reviewerId: tenant.id,
      listingId: listing.id,
      rentalId: rental.id,
      rating: 5
    });

    const reviewedOwner = await getUserById(owner.id);
    expect(reviewedOwner?.reputationScore).toBeGreaterThan(0);
  });
});
