import { DomainError } from "../../domain/shared/errors/domain-error";
import type { RiskLevel } from "../../domain/shared/risk/risk-level";
import { createReportRecord, getListingById, getRentalById, getUserById } from "../../infra/persistence/in-memory-store";

interface CreateReportInput {
  reporterId: string;
  listingId?: string;
  rentalId?: string;
  reason: string;
  details?: string;
}

function classifyReportRisk(reason: string, details?: string): RiskLevel {
  const content = `${reason} ${details ?? ""}`.toLowerCase();

  if (content.includes("golpe") || content.includes("fraude") || content.includes("amea")) {
    return "CRITICAL";
  }

  if (content.includes("abuso") || content.includes("discrimina") || content.includes("extors")) {
    return "HIGH";
  }

  if (content.includes("spam") || content.includes("suspeito")) {
    return "MEDIUM";
  }

  return "LOW";
}

export async function createReport(input: CreateReportInput) {
  const reporter = await getUserById(input.reporterId);

  if (!reporter) {
    throw new DomainError("Reporter not found.", 404, "ReporterNotFound");
  }

  if (!input.listingId && !input.rentalId) {
    throw new DomainError("Report must target listing or rental.", 400, "InvalidReportTarget");
  }

  if (input.listingId && !(await getListingById(input.listingId))) {
    throw new DomainError("Listing target not found.", 404, "ListingNotFound");
  }

  if (input.rentalId && !(await getRentalById(input.rentalId))) {
    throw new DomainError("Rental target not found.", 404, "RentalNotFound");
  }

  const riskLevel = classifyReportRisk(input.reason, input.details);

  return createReportRecord({
    reporterId: reporter.id,
    listingId: input.listingId,
    rentalId: input.rentalId,
    reason: input.reason,
    details: input.details,
    riskLevel
  });
}
