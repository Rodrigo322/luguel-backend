import { DomainError } from "../../domain/shared/errors/domain-error";
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

  const isAdmin = input.requesterRole === "ADMIN";
  const isOwner = listing.ownerId === input.requesterId;

  if (!isAdmin && !isOwner) {
    throw new DomainError("Only owner or admin can update rental status.", 403, "RentalForbidden");
  }

  const updatedRental = await updateRentalStatus(rental.id, input.status);

  if (!updatedRental) {
    throw new DomainError("Rental not found after update operation.", 404, "RentalNotFound");
  }

  return updatedRental;
}
