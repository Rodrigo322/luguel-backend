import { DomainError } from "../../shared/errors/domain-error";
import type { UserRole } from "../../../shared/types/role";

export function ensureBoostWriteAccess(input: {
  requesterId: string;
  requesterRole: UserRole;
  listingOwnerId: string;
}): void {
  const isAdmin = input.requesterRole === "ADMIN";
  const isOwner = input.requesterId === input.listingOwnerId;

  if (!isAdmin && !isOwner) {
    throw new DomainError("Only listing owner or admin can boost.", 403, "BoostForbidden");
  }
}

export function ensureBoostPaymentConfirmed(paymentConfirmed: boolean): void {
  if (!paymentConfirmed) {
    throw new DomainError("Payment confirmation is required for boost.", 400, "PaymentRequired");
  }
}

export function ensureBoostAmountIsValid(amount: number): void {
  if (amount <= 0) {
    throw new DomainError("Boost amount must be greater than zero.", 400, "InvalidBoostAmount");
  }
}

export function ensureBoostDurationIsValid(days: number): void {
  if (days < 1 || days > 30) {
    throw new DomainError("Boost duration must be between 1 and 30 days.", 400, "InvalidBoostDuration");
  }
}
