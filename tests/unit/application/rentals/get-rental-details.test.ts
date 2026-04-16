import { beforeEach, describe, expect, it } from "vitest";
import { getRentalDetails } from "../../../../src/application/rentals/get-rental-details";
import {
  createListingRecord,
  createRentalRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("getRentalDetails", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should allow tenant to read own rental", async () => {
    const owner = await upsertUserFromAuth({ id: "owner-rd-1", email: "owner-rd-1@example.com", name: "Owner" });
    const tenant = await upsertUserFromAuth({ id: "tenant-rd-1", email: "tenant-rd-1@example.com", name: "Tenant" });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Anuncio",
      description: "Descricao suficiente para leitura de locacao.",
      dailyPrice: 180,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    const rental = await createRentalRecord({
      listingId: listing.id,
      tenantId: tenant.id,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2026-09-03T00:00:00.000Z"),
      totalPrice: 360,
      status: "REQUESTED"
    });

    const found = await getRentalDetails({
      requesterId: tenant.id,
      requesterRole: tenant.role,
      rentalId: rental.id
    });

    expect(found.id).toBe(rental.id);
  });

  it("should block unrelated user", async () => {
    const owner = await upsertUserFromAuth({ id: "owner-rd-2", email: "owner-rd-2@example.com", name: "Owner" });
    const tenant = await upsertUserFromAuth({ id: "tenant-rd-2", email: "tenant-rd-2@example.com", name: "Tenant" });
    const outsider = await upsertUserFromAuth({ id: "outsider-rd-2", email: "outsider-rd-2@example.com", name: "Outsider" });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Anuncio",
      description: "Descricao suficiente para leitura de locacao.",
      dailyPrice: 180,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    const rental = await createRentalRecord({
      listingId: listing.id,
      tenantId: tenant.id,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2026-09-03T00:00:00.000Z"),
      totalPrice: 360,
      status: "REQUESTED"
    });

    await expect(
      getRentalDetails({
        requesterId: outsider.id,
        requesterRole: outsider.role,
        rentalId: rental.id
      })
    ).rejects.toMatchObject({ code: "RentalReadForbidden" });
  });
});
