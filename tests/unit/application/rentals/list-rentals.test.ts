import { beforeEach, describe, expect, it } from "vitest";
import { listRentals } from "../../../../src/application/rentals/list-rentals";
import {
  createListingRecord,
  createRentalRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("listRentals", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should list all rentals for admin", async () => {
    const owner = await upsertUserFromAuth({ id: "owner-lr-1", email: "owner-lr-1@example.com", name: "Owner" });
    const tenant = await upsertUserFromAuth({ id: "tenant-lr-1", email: "tenant-lr-1@example.com", name: "Tenant" });
    const admin = await upsertUserFromAuth({ id: "admin-lr-1", email: "admin@example.com", name: "Admin" });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Anuncio",
      description: "Descricao suficiente para listagem de locacoes.",
      dailyPrice: 190,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    await createRentalRecord({
      listingId: listing.id,
      tenantId: tenant.id,
      startDate: new Date("2026-09-10T00:00:00.000Z"),
      endDate: new Date("2026-09-12T00:00:00.000Z"),
      totalPrice: 380,
      status: "REQUESTED"
    });

    const rentals = await listRentals({
      requesterId: admin.id,
      requesterRole: admin.role
    });

    expect(rentals).toHaveLength(1);
  });
});
