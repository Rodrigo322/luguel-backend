import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  ensureRentalStatusChangeAuthorized,
  ensureRentalStatusTransition
} from "../../domain/rentals/services/rental-rules";
import { getListingById, getRentalById, updateRentalStatus } from "../../infra/persistence/in-memory-store";

interface UpdateRentalStatusInput {
  requesterId: string;
  requesterRole: "LOCADOR" | "LOCATARIO" | "ADMIN";
  rentalId: string;
  status: "APPROVED" | "ACTIVE" | "COMPLETED" | "CANCELED";
}

export async function updateRentalStatusFlow(input: UpdateRentalStatusInput) {
  const rental = await getRentalById(input.rentalId);

  if (!rental) {
    throw new DomainError("Rental not found.", 404, "RentalNotFound");
  }

  const listing = await getListingById(rental.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureRentalStatusChangeAuthorized({
    requesterId: input.requesterId,
    requesterRole: input.requesterRole,
    listingOwnerId: listing.ownerId
  });

  ensureRentalStatusTransition(rental.status, input.status);

  const updatedRental = await updateRentalStatus(rental.id, input.status);

  if (!updatedRental) {
    throw new DomainError("Rental not found after update operation.", 404, "RentalNotFound");
  }

  return updatedRental;
}
