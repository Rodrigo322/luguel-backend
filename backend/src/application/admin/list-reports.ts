import type { ReportStatus } from "../../domain/reports/entities/report";
import type { RiskLevel } from "../../domain/shared/risk/risk-level";
import { listReportRecords } from "../../infra/persistence/in-memory-store";

interface ListReportsInput {
  status?: ReportStatus;
  riskLevel?: RiskLevel;
  search?: string;
  page: number;
  pageSize: number;
}

export async function listReports(input: ListReportsInput) {
  const normalizedSearch = input.search?.trim().toLowerCase();

  const filtered = (await listReportRecords())
    .filter((report) => (input.status ? report.status === input.status : true))
    .filter((report) => (input.riskLevel ? report.riskLevel === input.riskLevel : true))
    .filter((report) => {
      if (!normalizedSearch) {
        return true;
      }

      const content = `${report.reason} ${report.details ?? ""} ${report.reporterId} ${
        report.listingId ?? ""
      } ${report.rentalId ?? ""}`.toLowerCase();

      return content.includes(normalizedSearch);
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / input.pageSize));
  const startIndex = (input.page - 1) * input.pageSize;
  const reports = filtered.slice(startIndex, startIndex + input.pageSize);

  return {
    reports,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages
    }
  };
}
