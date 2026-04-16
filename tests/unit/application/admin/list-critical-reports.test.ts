import { beforeEach, describe, expect, it } from "vitest";
import { listCriticalReports } from "../../../../src/application/admin/list-critical-reports";
import {
  createReportRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("listCriticalReports", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should return only OPEN and CRITICAL reports", async () => {
    const reporter = await upsertUserFromAuth({
      id: "reporter-admin-list",
      email: "reporter-admin-list@example.com",
      name: "Reporter Admin List"
    });

    await createReportRecord({
      reporterId: reporter.id,
      reason: "Fraude confirmada",
      details: "Sinais graves",
      riskLevel: "CRITICAL",
      status: "OPEN"
    });

    await createReportRecord({
      reporterId: reporter.id,
      reason: "Spam",
      details: "Sem gravidade critica",
      riskLevel: "MEDIUM",
      status: "OPEN"
    });

    await createReportRecord({
      reporterId: reporter.id,
      reason: "Caso resolvido",
      details: "Encerrado",
      riskLevel: "CRITICAL",
      status: "RESOLVED"
    });

    const criticalReports = await listCriticalReports();

    expect(criticalReports).toHaveLength(1);
    expect(criticalReports[0]?.riskLevel).toBe("CRITICAL");
    expect(criticalReports[0]?.status).toBe("OPEN");
  });
});
