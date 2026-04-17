import { beforeEach, describe, expect, it } from "vitest";
import { createReport } from "../../../../src/application/reports/create-report";
import {
  createListingRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("createReport", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should reject report without listingId or rentalId", async () => {
    const reporter = await upsertUserFromAuth({
      id: "reporter-empty",
      email: "reporter-empty@example.com",
      name: "Reporter Empty"
    });

    await expect(
      createReport({
        reporterId: reporter.id,
        reason: "Conteudo suspeito"
      })
    ).rejects.toMatchObject({
      code: "InvalidReportTarget"
    });
  });

  it("should classify severe fraud report as CRITICAL", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-report",
      email: "owner-report@example.com",
      name: "Owner Report"
    });
    const reporter = await upsertUserFromAuth({
      id: "reporter-critical",
      email: "reporter-critical@example.com",
      name: "Reporter Critical"
    });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Apartamento moderno",
      description: "Descricao valida para locacao.",
      dailyPrice: 240,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    const report = await createReport({
      reporterId: reporter.id,
      listingId: listing.id,
      reason: "Suspeita de golpe e fraude",
      details: "Anunciante pediu pagamento adiantado fora da plataforma com ameaça."
    });

    expect(report.riskLevel).toBe("CRITICAL");
    expect(report.status).toBe("OPEN");
  });
});
