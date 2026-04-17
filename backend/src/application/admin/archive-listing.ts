import { ensureListingCanBeModerated } from "../../domain/admin/services/admin-rules";
import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  createAdminAuditLogRecord,
  getListingById,
  updateListingStatus
} from "../../infra/persistence/in-memory-store";

interface ArchiveListingByAdminInput {
  adminId: string;
  listingId: string;
  reason: string;
}

export async function archiveListingByAdmin(input: ArchiveListingByAdminInput) {
  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureListingCanBeModerated(listing.status);

  const archived = await updateListingStatus(listing.id, "ARCHIVED");

  if (!archived) {
    throw new DomainError("Unable to archive listing.", 500, "ListingArchiveFailed");
  }

  await createAdminAuditLogRecord({
    adminId: input.adminId,
    action: "LISTING_ARCHIVED",
    entityType: "listing",
    entityId: listing.id,
    metadata: {
      reason: input.reason,
      previousStatus: listing.status
    }
  });

  return archived;
}
