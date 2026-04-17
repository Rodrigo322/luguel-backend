import { DomainError } from "../../domain/shared/errors/domain-error";
import type { UserRole } from "../../shared/types/role";
import {
  ensureAvailabilitySlotDate,
  ensureUniqueAvailabilityDates,
  ensureValidAvailabilityRange,
  ensureValidAvailabilityTime
} from "../../domain/listings/services/listing-availability-rules";
import { ensureListingWriteAccess } from "../../domain/listings/services/listing-rules";
import {
  getListingById,
  listListingAvailabilityByListing,
  replaceListingAvailabilitySlots
} from "../../infra/persistence/in-memory-store";

interface AvailabilitySlotInput {
  date: Date;
  status: "FREE" | "BLOCKED";
  pickupTime: string;
  returnTime: string;
}

interface SetListingAvailabilityInput {
  requesterId: string;
  requesterRole: UserRole;
  listingId: string;
  slots: AvailabilitySlotInput[];
}

interface GetListingAvailabilityInput {
  listingId: string;
  startDate?: Date;
  endDate?: Date;
}

function withinRange(date: Date, start?: Date, end?: Date): boolean {
  if (start && date < start) {
    return false;
  }

  if (end && date >= end) {
    return false;
  }

  return true;
}

export async function setListingAvailability(input: SetListingAvailabilityInput) {
  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureListingWriteAccess({
    actorId: input.requesterId,
    actorRole: input.requesterRole,
    ownerId: listing.ownerId
  });

  const normalizedSlots = input.slots.map((slot) => {
    ensureValidAvailabilityTime({
      pickupTime: slot.pickupTime,
      returnTime: slot.returnTime
    });

    return {
      ...slot,
      date: ensureAvailabilitySlotDate(slot.date),
      pickupTime: slot.pickupTime.trim(),
      returnTime: slot.returnTime.trim()
    };
  });

  ensureUniqueAvailabilityDates(normalizedSlots.map((slot) => slot.date));

  return replaceListingAvailabilitySlots({
    listingId: listing.id,
    slots: normalizedSlots
  });
}

export async function getListingAvailability(input: GetListingAvailabilityInput) {
  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  if (input.startDate && input.endDate) {
    ensureValidAvailabilityRange({
      start: input.startDate,
      end: input.endDate
    });
  }

  return (await listListingAvailabilityByListing(input.listingId)).filter((slot) =>
    withinRange(slot.date, input.startDate, input.endDate)
  );
}
