import { beforeEach, describe, expect, it } from "vitest";
import { updateRentalStatusFlow } from "../../../../src/application/rentals/update-rental-status";
import {
  createListingRecord,
  createRentalRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

async function setupRentalScenario() {
  const owner = await upsertUserFromAuth({
    id: "owner-status",
    email: "owner-status@example.com",
    name: "Owner Status"
  });
  const tenant = await upsertUserFromAuth({
    id: "tenant-status",
    email: "tenant-status@example.com",
    name: "Tenant Status"
  });
  const thirdUser = await upsertUserFromAuth({
    id: "third-status",
    email: "third-status@example.com",
    name: "Third Status"
  });

  const listing = await createListingRecord({
    ownerId: owner.id,
    title: "Casa de campo",
    description: "Descricao valida para locacao.",
    dailyPrice: 300,
    riskLevel: "LOW",
    status: "ACTIVE"
  });

  const rental = await createRentalRecord({
    listingId: listing.id,
    tenantId: tenant.id,
    startDate: new Date("2026-06-10T00:00:00.000Z"),
    endDate: new Date("2026-06-15T00:00:00.000Z"),
    totalPrice: 1500,
    status: "REQUESTED"
  });

  return { owner, tenant, thirdUser, rental };
}

describe("updateRentalStatusFlow", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should reject status update from non-owner non-admin users", async () => {
    const { thirdUser, rental } = await setupRentalScenario();

    await expect(
      updateRentalStatusFlow({
        requesterId: thirdUser.id,
        requesterRole: "LOCATARIO",
        rentalId: rental.id,
        status: "APPROVED"
      })
    ).rejects.toMatchObject({
      code: "RentalForbidden"
    });
  });

  it("should allow owner to update rental status", async () => {
    const { owner, rental } = await setupRentalScenario();

    const updatedRental = await updateRentalStatusFlow({
      requesterId: owner.id,
      requesterRole: "LOCADOR",
      rentalId: rental.id,
      status: "APPROVED"
    });

    expect(updatedRental.status).toBe("APPROVED");
  });

  it("should allow admin to update rental status", async () => {
    const { rental } = await setupRentalScenario();

    const updatedRental = await updateRentalStatusFlow({
      requesterId: "admin-status",
      requesterRole: "ADMIN",
      rentalId: rental.id,
      status: "CANCELED"
    });

    expect(updatedRental.status).toBe("CANCELED");
  });
});
