import { ensureReportReviewStatus } from "../../domain/admin/services/admin-rules";
import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  createAdminAuditLogRecord,
  getReportById,
  updateReportStatus
} from "../../infra/persistence/in-memory-store";

interface ReviewReportInput {
  adminId: string;
  reportId: string;
  status: "TRIAGED" | "RESOLVED" | "REJECTED";
  reason?: string;
}

export async function reviewReport(input: ReviewReportInput) {
  const report = await getReportById(input.reportId);

  if (!report) {
    throw new DomainError("Report not found.", 404, "ReportNotFound");
  }

  ensureReportReviewStatus(input.status);

  const updatedReport = await updateReportStatus(report.id, input.status);

  if (!updatedReport) {
    throw new DomainError("Unable to update report status.", 500, "ReportStatusUpdateFailed");
  }

  await createAdminAuditLogRecord({
    adminId: input.adminId,
    action: "REPORT_REVIEWED",
    entityType: "report",
    entityId: report.id,
    metadata: {
      previousStatus: report.status,
      status: input.status,
      reason: input.reason
    }
  });

  return updatedReport;
}
