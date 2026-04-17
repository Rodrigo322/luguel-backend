import { DomainError } from "../../shared/errors/domain-error";
import type { RiskLevel } from "../../shared/risk/risk-level";
import type { ListingStatus } from "../entities/listing";
import type { UserRole } from "../../../shared/types/role";

export function ensureValidDailyPrice(dailyPrice: number): void {
  if (dailyPrice <= 0) {
    throw new DomainError("Daily price must be greater than zero.", 400, "InvalidDailyPrice");
  }
}

export function resolveListingStatusFromRisk(riskLevel: RiskLevel): ListingStatus {
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    return "PENDING_VALIDATION";
  }

  return "ACTIVE";
}

export function ensureListingWriteAccess(input: {
  actorId: string;
  actorRole: UserRole;
  ownerId: string;
}): void {
  const isOwner = input.actorId === input.ownerId;
  const isAdmin = input.actorRole === "ADMIN";

  if (!isOwner && !isAdmin) {
    throw new DomainError("Only listing owner or admin can modify listing.", 403, "ListingForbidden");
  }
}

export function ensureListingCanBeArchived(currentStatus: ListingStatus): void {
  if (currentStatus === "ARCHIVED") {
    throw new DomainError("Listing is already archived.", 400, "ListingAlreadyArchived");
  }
}

export function ensureListingCanBeEdited(currentStatus: ListingStatus): void {
  if (currentStatus === "ARCHIVED") {
    throw new DomainError("Archived listing cannot be edited.", 400, "ListingNotEditable");
  }

  if (currentStatus === "SUSPENDED") {
    throw new DomainError("Suspended listing cannot be edited.", 400, "ListingNotEditable");
  }
}
