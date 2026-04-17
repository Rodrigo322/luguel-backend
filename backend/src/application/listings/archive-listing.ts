import {
  ensureListingCanBeArchived,
  ensureListingWriteAccess
} from "../../domain/listings/services/listing-rules";
import { DomainError } from "../../domain/shared/errors/domain-error";
import { getListingById, updateListingStatus } from "../../infra/persistence/in-memory-store";
import type { UserRole } from "../../shared/types/role";

interface ArchiveListingInput {
  requesterId: string;
  requesterRole: UserRole;
  listingId: string;
}

export async function archiveListing(input: ArchiveListingInput) {
  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureListingWriteAccess({
    actorId: input.requesterId,
    actorRole: input.requesterRole,
    ownerId: listing.ownerId
  });

  ensureListingCanBeArchived(listing.status);

  const archived = await updateListingStatus(listing.id, "ARCHIVED");

  if (!archived) {
    throw new DomainError("Unable to archive listing.", 500, "ListingArchiveFailed");
  }

  return archived;
}
