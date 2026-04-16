import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  calculateRentalDays,
  ensureListingAvailableForRental,
  ensureNotSelfRental,
  ensureValidRentalPeriod
} from "../../domain/rentals/services/rental-rules";
import { createRentalRecord, getListingById, getUserById } from "../../infra/persistence/in-memory-store";

interface RequestRentalInput {
  tenantId: string;
  listingId: string;
  startDate: Date;
  endDate: Date;
}

export async function requestRental(input: RequestRentalInput) {
  const tenant = await getUserById(input.tenantId);

  if (!tenant) {
    throw new DomainError("Tenant not found.", 404, "TenantNotFound");
  }

  if (tenant.isBanned) {
    throw new DomainError("Banned user cannot request rentals.", 403, "BannedUserForbidden");
  }

  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureListingAvailableForRental(listing.status);

  ensureNotSelfRental(listing.ownerId, tenant.id);

  ensureValidRentalPeriod(input.startDate, input.endDate);

  const rentalDays = calculateRentalDays(input.startDate, input.endDate);
  const totalPrice = rentalDays * listing.dailyPrice;

  return createRentalRecord({
    listingId: listing.id,
    tenantId: tenant.id,
    startDate: input.startDate,
    endDate: input.endDate,
    totalPrice,
    status: "REQUESTED"
  });
}
