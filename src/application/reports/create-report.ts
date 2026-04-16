import { DomainError } from "../../domain/shared/errors/domain-error";
import { classifyReportRisk, ensureReportHasValidTarget } from "../../domain/reports/services/report-rules";
import {
  createReportRecord,
  getListingById,
  getRentalById,
  getUserById,
  listReportRecords,
  updateListingStatus
} from "../../infra/persistence/in-memory-store";

interface CreateReportInput {
  reporterId: string;
  listingId?: string;
  rentalId?: string;
  reason: string;
  details?: string;
}

export async function createReport(input: CreateReportInput) {
  const reporter = await getUserById(input.reporterId);

  if (!reporter) {
    throw new DomainError("Reporter not found.", 404, "ReporterNotFound");
  }

  ensureReportHasValidTarget({ listingId: input.listingId, rentalId: input.rentalId });

  if (input.listingId && !(await getListingById(input.listingId))) {
    throw new DomainError("Listing target not found.", 404, "ListingNotFound");
  }

  if (input.rentalId && !(await getRentalById(input.rentalId))) {
    throw new DomainError("Rental target not found.", 404, "RentalNotFound");
  }

  const riskLevel = classifyReportRisk(input.reason, input.details);

  const report = await createReportRecord({
    reporterId: reporter.id,
    listingId: input.listingId,
    rentalId: input.rentalId,
    reason: input.reason,
    details: input.details,
    riskLevel
  });

  if (input.listingId) {
    const openReportsForListing = (await listReportRecords()).filter(
      (listedReport) => listedReport.listingId === input.listingId && listedReport.status === "OPEN"
    );

    if (openReportsForListing.length >= 3) {
      const listing = await getListingById(input.listingId);

      if (listing && listing.status !== "SUSPENDED" && listing.status !== "ARCHIVED") {
        await updateListingStatus(listing.id, "PENDING_VALIDATION");
      }
    }
  }

  return report;
}
