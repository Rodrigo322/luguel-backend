import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  ensurePremiumEligibleRole,
  ensurePremiumSubscriptionInput
} from "../../domain/users/services/premium-rules";
import {
  createPremiumSubscription,
  getLatestPremiumSubscription,
  getUserById
} from "../../infra/persistence/in-memory-store";

interface SubscribePremiumInput {
  requesterId: string;
  months: number;
  amount: number;
  paymentConfirmed: boolean;
}

export async function subscribePremiumFlow(input: SubscribePremiumInput) {
  const requester = await getUserById(input.requesterId);

  if (!requester) {
    throw new DomainError("User not found.", 404, "UserNotFound");
  }

  ensurePremiumEligibleRole(requester.role);
  ensurePremiumSubscriptionInput({
    months: input.months,
    amount: input.amount,
    paymentConfirmed: input.paymentConfirmed
  });

  return createPremiumSubscription({
    userId: requester.id,
    months: input.months,
    amount: input.amount,
    status: "ACTIVE"
  });
}

export async function getPremiumStatusFlow(requesterId: string) {
  const requester = await getUserById(requesterId);

  if (!requester) {
    throw new DomainError("User not found.", 404, "UserNotFound");
  }

  const latestSubscription = await getLatestPremiumSubscription(requester.id);

  return {
    plan: requester.plan,
    planExpiresAt: requester.planExpiresAt,
    subscription: latestSubscription
  };
}

