import { ensureListingCanBeModerated } from "../../domain/admin/services/admin-rules";
import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  createAdminAuditLogRecord,
  getListingById,
  updateListingStatus
} from "../../infra/persistence/in-memory-store";

interface RejectListingByAdminInput {
  adminId: string;
  listingId: string;
  reason: string;
}

export async function rejectListingByAdmin(input: RejectListingByAdminInput) {
  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureListingCanBeModerated(listing.status);

  if (listing.status === "SUSPENDED") {
    throw new DomainError("Listing is already suspended.", 400, "ListingAlreadySuspended");
  }

  const rejected = await updateListingStatus(listing.id, "SUSPENDED");

  if (!rejected) {
    throw new DomainError("Unable to reject listing.", 500, "ListingRejectFailed");
  }

  await createAdminAuditLogRecord({
    adminId: input.adminId,
    action: "LISTING_REJECTED",
    entityType: "listing",
    entityId: listing.id,
    metadata: {
      reason: input.reason,
      previousStatus: listing.status
    }
  });

  return rejected;
}
