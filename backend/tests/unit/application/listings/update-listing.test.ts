import { beforeEach, describe, expect, it } from "vitest";
import { updateListing } from "../../../../src/application/listings/update-listing";
import {
  createListingRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("updateListing", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should block update from non-owner and non-admin", async () => {
    const owner = await upsertUserFromAuth({ id: "owner-listing", email: "owner-l-u@example.com", name: "Owner" });
    const outsider = await upsertUserFromAuth({ id: "outsider-listing", email: "outsider-l-u@example.com", name: "Outsider" });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Titulo",
      description: "Descricao suficientemente longa para manter anuncio valido.",
      dailyPrice: 100,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    await expect(
      updateListing({
        requesterId: outsider.id,
        requesterRole: outsider.role,
        listingId: listing.id,
        title: "Novo titulo"
      })
    ).rejects.toMatchObject({ code: "ListingForbidden" });
  });

  it("should update listing and reclassify risk", async () => {
    const owner = await upsertUserFromAuth({ id: "owner-listing-2", email: "owner-l-2@example.com", name: "Owner 2" });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Titulo inicial",
      description: "Descricao inicial suficiente para um anuncio regular com informacoes.",
      dailyPrice: 120,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    const result = await updateListing({
      requesterId: owner.id,
      requesterRole: owner.role,
      listingId: listing.id,
      dailyPrice: 14000,
      description: "Negociacao via pix adiantado, whatsapp e crypto fora da plataforma."
    });

    expect(result.listing.status).toBe("PENDING_VALIDATION");
    expect(result.risk.level).toBe("CRITICAL");
  });
});
