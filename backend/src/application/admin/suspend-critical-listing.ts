import { DomainError } from "../../domain/shared/errors/domain-error";
import { ensureListingIsCriticalCase } from "../../domain/admin/services/admin-rules";
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

export async function suspendCriticalListing(input: SuspendCriticalListingInput) {
  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureListingIsCriticalCase(listing.riskLevel);

  const suspended = await updateListingStatus(listing.id, "SUSPENDED");

  if (!suspended) {
    throw new DomainError("Unable to suspend listing.", 500, "SuspendFailed");
  }

  const relatedOpenReports = (await listReportRecords()).filter(
    (report) => report.listingId === listing.id && report.status === "OPEN"
  );

  for (const report of relatedOpenReports) {
    await updateReportStatus(report.id, "TRIAGED");
  }

  await createAdminAuditLogRecord({
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
