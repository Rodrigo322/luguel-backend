import { DomainError } from "../../domain/shared/errors/domain-error";
import { createRentalRecord, getListingById, getUserById } from "../../infra/persistence/in-memory-store";

interface RequestRentalInput {
  tenantId: string;
  listingId: string;
  startDate: Date;
  endDate: Date;
}

function calculateRentalDays(startDate: Date, endDate: Date): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const difference = Math.ceil((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
  return Math.max(1, difference);
}

export async function requestRental(input: RequestRentalInput) {
  const tenant = await getUserById(input.tenantId);

  if (!tenant) {
    throw new DomainError("Tenant not found.", 404, "TenantNotFound");
  }

  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  if (listing.status !== "ACTIVE") {
    throw new DomainError("Listing is not available for rental.", 400, "ListingUnavailable");
  }

  if (listing.ownerId === tenant.id) {
    throw new DomainError("Owner cannot rent their own listing.", 400, "SelfRentalNotAllowed");
  }

  if (input.startDate >= input.endDate) {
    throw new DomainError("Invalid rental period.", 400, "InvalidRentalPeriod");
  }

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
