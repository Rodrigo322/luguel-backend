import { beforeEach, describe, expect, it } from "vitest";
import { requestRental } from "../../../../src/application/rentals/request-rental";
import {
  createListingRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("requestRental", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should block self rental attempts", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-self",
      email: "owner-self@example.com",
      name: "Owner Self"
    });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Casa na praia",
      description: "Anuncio regular para locacao.",
      dailyPrice: 100,
      riskLevel: "LOW",
      status: "ACTIVE"
    });

    await expect(
      requestRental({
        tenantId: owner.id,
        listingId: listing.id,
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        endDate: new Date("2026-06-04T00:00:00.000Z")
      })
    ).rejects.toMatchObject({
      code: "SelfRentalNotAllowed"
    });
  });

  it("should block requests for unavailable listings", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-unavailable",
      email: "owner-unavailable@example.com",
      name: "Owner unavailable"
    });
    const tenant = await upsertUserFromAuth({
      id: "tenant-unavailable",
      email: "tenant-unavailable@example.com",
      name: "Tenant unavailable"
    });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Loft central",
      description: "Descricao valida para locacao.",
      dailyPrice: 200,
      riskLevel: "LOW",
      status: "SUSPENDED"
    });

    await expect(
      requestRental({
        tenantId: tenant.id,
        listingId: listing.id,
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        endDate: new Date("2026-06-04T00:00:00.000Z")
      })
    ).rejects.toMatchObject({
      code: "ListingUnavailable"
    });
  });

  it("should calculate total price based on rental days", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-price",
      email: "owner-price@example.com",
      name: "Owner Price"
    });
    const tenant = await upsertUserFromAuth({
      id: "tenant-price",
      email: "tenant-price@example.com",
      name: "Tenant Price"
    });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Apartamento mobiliado",
      description: "Descricao valida para locacao.",
      dailyPrice: 150,
      riskLevel: "LOW",
      status: "ACTIVE"
    });

    const rental = await requestRental({
      tenantId: tenant.id,
      listingId: listing.id,
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-04T00:00:00.000Z")
    });

    expect(rental.status).toBe("REQUESTED");
    expect(rental.totalPrice).toBe(450);
  });
});
