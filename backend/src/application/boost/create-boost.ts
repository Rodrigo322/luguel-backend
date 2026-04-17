import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  ensureBoostAmountIsValid,
  ensureBoostDurationIsValid,
  ensureBoostPaymentConfirmed,
  ensureBoostWriteAccess
} from "../../domain/boost/services/boost-rules";
import { createBoostRecord, getListingById, getUserById } from "../../infra/persistence/in-memory-store";

interface CreateBoostInput {
  requesterId: string;
  listingId: string;
  amount: number;
  days: number;
  paymentConfirmed: boolean;
}

export async function createBoost(input: CreateBoostInput) {
  const requester = await getUserById(input.requesterId);

  if (!requester) {
    throw new DomainError("Requester not found.", 404, "RequesterNotFound");
  }

  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureBoostWriteAccess({
    requesterId: requester.id,
    requesterRole: requester.role,
    listingOwnerId: listing.ownerId
  });
  ensureBoostPaymentConfirmed(input.paymentConfirmed);
  ensureBoostAmountIsValid(input.amount);
  ensureBoostDurationIsValid(input.days);

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + input.days * 24 * 60 * 60 * 1000);

  return createBoostRecord({
    listingId: listing.id,
    status: "ACTIVE",
    amount: input.amount,
    startsAt,
    endsAt
  });
}
