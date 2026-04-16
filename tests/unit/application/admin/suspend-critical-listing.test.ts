import { beforeEach, describe, expect, it } from "vitest";
import { suspendCriticalListing } from "../../../../src/application/admin/suspend-critical-listing";
import {
  createListingRecord,
  createReportRecord,
  getListingById,
  listCriticalOpenReports,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("suspendCriticalListing", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should reject admin suspension for non-critical listings", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-admin-noncritical",
      email: "owner-admin-noncritical@example.com",
      name: "Owner Noncritical"
    });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Anuncio regular",
      description: "Descricao valida para locacao.",
      dailyPrice: 180,
      riskLevel: "LOW",
      status: "ACTIVE"
    });

    await expect(
      suspendCriticalListing({
        adminId: "admin-1",
        listingId: listing.id,
        reason: "Acao administrativa"
      })
    ).rejects.toMatchObject({
      code: "NotCriticalCase"
    });
  });

  it("should suspend listing and triage related critical reports", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-admin-critical",
      email: "owner-admin-critical@example.com",
      name: "Owner Critical"
    });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Anuncio suspeito",
      description: "Descricao valida para locacao.",
      dailyPrice: 8900,
      riskLevel: "CRITICAL",
      status: "FLAGGED"
    });

    await createReportRecord({
      reporterId: owner.id,
      listingId: listing.id,
      reason: "Risco critico",
      details: "Sinalizacao automatica",
      riskLevel: "CRITICAL",
      status: "OPEN"
    });

    const suspendedListing = await suspendCriticalListing({
      adminId: "admin-2",
      listingId: listing.id,
      reason: "Confirmado risco critico"
    });

    const storedListing = await getListingById(suspendedListing.id);
    const remainingCriticalOpenReports = await listCriticalOpenReports();

    expect(storedListing?.status).toBe("SUSPENDED");
    expect(remainingCriticalOpenReports).toHaveLength(0);
  });
});
