import { beforeEach, describe, expect, it } from "vitest";
import { reviewReport } from "../../../../src/application/admin/review-report";
import {
  createReportRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("reviewReport", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should update report status", async () => {
    const reporter = await upsertUserFromAuth({
      id: "review-report-user",
      email: "review-report-user@example.com",
      name: "Reporter"
    });

    const report = await createReportRecord({
      reporterId: reporter.id,
      reason: "conteudo suspeito",
      riskLevel: "MEDIUM"
    });

    const updated = await reviewReport({
      adminId: "admin-review",
      reportId: report.id,
      status: "TRIAGED",
      reason: "Triagem executada"
    });

    expect(updated.status).toBe("TRIAGED");
  });

  it("should reject open as review status", async () => {
    const reporter = await upsertUserFromAuth({
      id: "review-report-user-2",
      email: "review-report-user-2@example.com",
      name: "Reporter"
    });

    const report = await createReportRecord({
      reporterId: reporter.id,
      reason: "conteudo suspeito",
      riskLevel: "MEDIUM"
    });

    await expect(
      reviewReport({
        adminId: "admin-review",
        reportId: report.id,
        status: "OPEN"
      } as never)
    ).rejects.toMatchObject({ code: "InvalidReviewStatus" });
  });
});
