import { beforeEach, describe, expect, it } from "vitest";
import { archiveListingByAdmin } from "../../../../src/application/admin/archive-listing";
import {
  createListingRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("archiveListingByAdmin", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should archive listing by admin flow", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-admin-archive",
      email: "owner-admin-archive@example.com",
      name: "Owner"
    });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Anuncio",
      description: "Descricao completa para operacao administrativa.",
      dailyPrice: 200,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    const archived = await archiveListingByAdmin({
      adminId: "admin-id",
      listingId: listing.id,
      reason: "Remocao administrativa"
    });

    expect(archived.status).toBe("ARCHIVED");
  });
});
