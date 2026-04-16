import { DomainError } from "../../domain/shared/errors/domain-error";
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

  const isAdmin = requester.role === "ADMIN";
  const isOwner = listing.ownerId === requester.id;

  if (!isAdmin && !isOwner) {
    throw new DomainError("Only listing owner or admin can boost.", 403, "BoostForbidden");
  }

  if (!input.paymentConfirmed) {
    throw new DomainError("Payment confirmation is required for boost.", 400, "PaymentRequired");
  }

  if (input.amount <= 0) {
    throw new DomainError("Boost amount must be greater than zero.", 400, "InvalidBoostAmount");
  }

  if (input.days < 1 || input.days > 30) {
    throw new DomainError("Boost duration must be between 1 and 30 days.", 400, "InvalidBoostDuration");
  }

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
