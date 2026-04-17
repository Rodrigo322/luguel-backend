import { beforeEach, describe, expect, it } from "vitest";
import { createListing } from "../../../../src/application/listings/create-listing";
import {
  listReportRecords,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("createListing", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should reject listing creation when owner does not exist", async () => {
    await expect(
      createListing({
        ownerId: "missing-owner",
        title: "Apartamento completo",
        description: "Descricao valida para anuncio com texto suficiente para passar na validacao.",
        dailyPrice: 180
      })
    ).rejects.toMatchObject({
      code: "OwnerNotFound"
    });
  });

  it("should reject listing with non-positive daily price", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-1",
      email: "owner1@example.com",
      name: "Owner One"
    });

    await expect(
      createListing({
        ownerId: owner.id,
        title: "Anuncio invalido",
        description: "Descricao valida para anuncio com texto suficiente para passar na validacao.",
        dailyPrice: 0
      })
    ).rejects.toMatchObject({
      code: "InvalidDailyPrice"
    });
  });

  it("should set listing as pending validation and report critical risk listing", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-2",
      email: "owner2@example.com",
      name: "Owner Two"
    });

    const result = await createListing({
      ownerId: owner.id,
      title: "Cobertura pagamento pix adiantado",
      description: "Negocio por whatsapp com pagamento crypto fora da plataforma.",
      dailyPrice: 13000
    });

    const reports = await listReportRecords();

    expect(result.listing.status).toBe("PENDING_VALIDATION");
    expect(result.risk.level).toBe("CRITICAL");
    expect(reports).toHaveLength(1);
    expect(reports[0]?.listingId).toBe(result.listing.id);
    expect(reports[0]?.riskLevel).toBe("CRITICAL");
  });
});
