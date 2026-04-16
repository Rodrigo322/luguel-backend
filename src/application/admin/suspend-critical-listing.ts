import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  createAdminAuditLogRecord,
  getListingById,
  listReportRecords,
  updateListingStatus,
  updateReportStatus
} from "../../infra/persistence/in-memory-store";

interface SuspendCriticalListingInput {
  adminId: string;
  listingId: string;
  reason: string;
}

export function suspendCriticalListing(input: SuspendCriticalListingInput) {
  const listing = getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  if (listing.riskLevel !== "CRITICAL") {
    throw new DomainError("Admin intervention is allowed only for critical listings.", 400, "NotCriticalCase");
  }

  const suspended = updateListingStatus(listing.id, "SUSPENDED");

  if (!suspended) {
    throw new DomainError("Unable to suspend listing.", 500, "SuspendFailed");
  }

  const relatedOpenReports = listReportRecords().filter(
    (report) => report.listingId === listing.id && report.status === "OPEN"
  );

  for (const report of relatedOpenReports) {
    updateReportStatus(report.id, "TRIAGED");
  }

  createAdminAuditLogRecord({
    adminId: input.adminId,
    action: "LISTING_SUSPENDED",
    entityType: "listing",
    entityId: listing.id,
    metadata: {
      reason: input.reason,
      previousStatus: listing.status,
      newStatus: "SUSPENDED"
    }
  });

  return suspended;
}
