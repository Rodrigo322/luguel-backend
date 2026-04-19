import { DomainError } from "../../shared/errors/domain-error";
import type { UserRole } from "../../../shared/types/role";

export function ensurePremiumSubscriptionInput(input: {
  months: number;
  amount: number;
  paymentConfirmed: boolean;
}): void {
  if (!Number.isInteger(input.months) || input.months < 1 || input.months > 12) {
    throw new DomainError("Premium subscription must be between 1 and 12 months.", 400, "InvalidPremiumMonths");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new DomainError("Premium amount must be greater than zero.", 400, "InvalidPremiumAmount");
  }

  if (!input.paymentConfirmed) {
    throw new DomainError("Payment confirmation is required for premium subscription.", 400, "PremiumPaymentRequired");
  }
}

export function ensurePremiumEligibleRole(role: UserRole): void {
  if (role !== "LOCADOR" && role !== "ADMIN") {
    throw new DomainError("Only advertisers (locador) can subscribe premium plan.", 403, "PremiumRoleForbidden");
  }
}

