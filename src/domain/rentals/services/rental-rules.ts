import { DomainError } from "../../shared/errors/domain-error";
import type { UserRole } from "../../../shared/types/role";
import type { RentalStatus } from "../entities/rental";
import type { ListingStatus } from "../../listings/entities/listing";

const allowedStatusTransitions: Record<RentalStatus, RentalStatus[]> = {
  REQUESTED: ["APPROVED", "CANCELED"],
  APPROVED: ["ACTIVE", "CANCELED"],
  ACTIVE: ["COMPLETED", "CANCELED"],
  COMPLETED: [],
  CANCELED: [],
  DISPUTED: []
};

export function calculateRentalDays(startDate: Date, endDate: Date): number {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const difference = Math.ceil((endDate.getTime() - startDate.getTime()) / millisecondsPerDay);
  return Math.max(1, difference);
}

export function ensureValidRentalPeriod(startDate: Date, endDate: Date): void {
  if (startDate >= endDate) {
    throw new DomainError("Invalid rental period.", 400, "InvalidRentalPeriod");
  }
}

export function ensureListingAvailableForRental(listingStatus: ListingStatus): void {
  if (listingStatus !== "ACTIVE") {
    throw new DomainError("Listing is not available for rental.", 400, "ListingUnavailable");
  }
}

export function ensureNotSelfRental(ownerId: string, tenantId: string): void {
  if (ownerId === tenantId) {
    throw new DomainError("Owner cannot rent their own listing.", 400, "SelfRentalNotAllowed");
  }
}

export function ensureRentalStatusChangeAuthorized(input: {
  requesterId: string;
  requesterRole: UserRole;
  listingOwnerId: string;
}): void {
  const isAdmin = input.requesterRole === "ADMIN";
  const isOwner = input.listingOwnerId === input.requesterId;

  if (!isAdmin && !isOwner) {
    throw new DomainError("Only owner or admin can update rental status.", 403, "RentalForbidden");
  }
}

export function ensureRentalStatusTransition(currentStatus: RentalStatus, nextStatus: RentalStatus): void {
  const allowedTargets = allowedStatusTransitions[currentStatus] ?? [];

  if (!allowedTargets.includes(nextStatus)) {
    throw new DomainError("Invalid rental status transition.", 400, "InvalidRentalStatusTransition");
  }
}

export function ensureRentalReadAccess(input: {
  requesterId: string;
  requesterRole: UserRole;
  rentalTenantId: string;
  listingOwnerId: string;
}): void {
  const isAdmin = input.requesterRole === "ADMIN";
  const isTenant = input.rentalTenantId === input.requesterId;
  const isOwner = input.listingOwnerId === input.requesterId;

  if (!isAdmin && !isTenant && !isOwner) {
    throw new DomainError("User is not allowed to access this rental.", 403, "RentalReadForbidden");
  }
}
