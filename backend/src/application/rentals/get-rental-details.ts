import { ensureRentalReadAccess } from "../../domain/rentals/services/rental-rules";
import { DomainError } from "../../domain/shared/errors/domain-error";
import { getListingById, getRentalById } from "../../infra/persistence/in-memory-store";
import type { UserRole } from "../../shared/types/role";

interface GetRentalDetailsInput {
  requesterId: string;
  requesterRole: UserRole;
  rentalId: string;
}

export async function getRentalDetails(input: GetRentalDetailsInput) {
  const rental = await getRentalById(input.rentalId);

  if (!rental) {
    throw new DomainError("Rental not found.", 404, "RentalNotFound");
  }

  const listing = await getListingById(rental.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureRentalReadAccess({
    requesterId: input.requesterId,
    requesterRole: input.requesterRole,
    rentalTenantId: rental.tenantId,
    listingOwnerId: listing.ownerId
  });

  return rental;
}
