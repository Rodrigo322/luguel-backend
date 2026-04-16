import { beforeEach, describe, expect, it } from "vitest";
import { archiveListing } from "../../../../src/application/listings/archive-listing";
import {
  createListingRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("archiveListing", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should archive listing by owner", async () => {
    const owner = await upsertUserFromAuth({ id: "owner-a-1", email: "owner-a-1@example.com", name: "Owner" });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Titulo",
      description: "Descricao valida e suficientemente longa para anuncio.",
      dailyPrice: 120,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    const archived = await archiveListing({
      requesterId: owner.id,
      requesterRole: owner.role,
      listingId: listing.id
    });

    expect(archived.status).toBe("ARCHIVED");
  });

  it("should reject archive by unauthorized user", async () => {
    const owner = await upsertUserFromAuth({ id: "owner-a-2", email: "owner-a-2@example.com", name: "Owner" });
    const outsider = await upsertUserFromAuth({ id: "outsider-a-2", email: "outsider-a-2@example.com", name: "Outsider" });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Titulo",
      description: "Descricao valida e suficientemente longa para anuncio.",
      dailyPrice: 120,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    await expect(
      archiveListing({
        requesterId: outsider.id,
        requesterRole: outsider.role,
        listingId: listing.id
      })
    ).rejects.toMatchObject({ code: "ListingForbidden" });
  });
});
