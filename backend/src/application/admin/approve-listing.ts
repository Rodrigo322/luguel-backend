import { ensureListingCanBeModerated } from "../../domain/admin/services/admin-rules";
import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  createAdminAuditLogRecord,
  getListingById,
  updateListingStatus
} from "../../infra/persistence/in-memory-store";

interface ApproveListingByAdminInput {
  adminId: string;
  listingId: string;
}

export async function approveListingByAdmin(input: ApproveListingByAdminInput) {
  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureListingCanBeModerated(listing.status);

  if (listing.status === "ACTIVE") {
    throw new DomainError("Listing is already active.", 400, "ListingAlreadyActive");
  }

  const approved = await updateListingStatus(listing.id, "ACTIVE");

  if (!approved) {
    throw new DomainError("Unable to approve listing.", 500, "ListingApproveFailed");
  }

  await createAdminAuditLogRecord({
    adminId: input.adminId,
    action: "LISTING_APPROVED",
    entityType: "listing",
    entityId: listing.id,
    metadata: {
      previousStatus: listing.status
    }
  });

  return approved;
}
