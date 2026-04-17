import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  createAdminAuditLogRecord,
  getListingById,
  getRentalById,
  getReportById,
  updateListingStatus,
  updateRentalStatus,
  updateReportStatus
} from "../../infra/persistence/in-memory-store";

interface TakeDownReportContentInput {
  adminId: string;
  reportId: string;
  reason: string;
}

export async function takeDownReportContent(input: TakeDownReportContentInput) {
  const report = await getReportById(input.reportId);

  if (!report) {
    throw new DomainError("Report not found.", 404, "ReportNotFound");
  }

  if (report.status === "RESOLVED" || report.status === "REJECTED") {
    throw new DomainError("Report is already finalized.", 400, "ReportAlreadyFinalized");
  }

  if (report.listingId) {
    const listing = await getListingById(report.listingId);

    if (!listing) {
      throw new DomainError("Listing target not found.", 404, "ListingNotFound");
    }

    if (listing.status !== "ARCHIVED") {
      const archived = await updateListingStatus(listing.id, "ARCHIVED");

      if (!archived) {
        throw new DomainError("Unable to archive listing target.", 500, "ListingTakeDownFailed");
      }
    }
  } else if (report.rentalId) {
    const rental = await getRentalById(report.rentalId);

    if (!rental) {
      throw new DomainError("Rental target not found.", 404, "RentalNotFound");
    }

    if (!["REQUESTED", "APPROVED", "ACTIVE"].includes(rental.status)) {
      throw new DomainError(
        "Rental target cannot be canceled in current status.",
        400,
        "RentalTakeDownNotAllowed"
      );
    }

    const canceledRental = await updateRentalStatus(rental.id, "CANCELED");

    if (!canceledRental) {
      throw new DomainError("Unable to cancel rental target.", 500, "RentalTakeDownFailed");
    }
  } else {
    throw new DomainError("Report target is invalid.", 400, "InvalidReportTarget");
  }

  const resolvedReport = await updateReportStatus(report.id, "RESOLVED");

  if (!resolvedReport) {
    throw new DomainError("Unable to resolve report after takedown.", 500, "ReportResolutionFailed");
  }

  await createAdminAuditLogRecord({
    adminId: input.adminId,
    action: "REPORT_CONTENT_TAKEDOWN",
    entityType: "report",
    entityId: report.id,
    metadata: {
      reason: input.reason,
      listingId: report.listingId,
      rentalId: report.rentalId
    }
  });

  return resolvedReport;
}
