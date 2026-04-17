import {
  canTreatSlotAsAvailable,
  ensureValidAvailabilityRange,
  supportsRequestedBookingMode,
  supportsRequestedDeliveryMode
} from "../../domain/listings/services/listing-availability-rules";
import {
  listListingAvailabilityRecords,
  listListingRecords,
  listListingsByOwner,
  listRentalRecords,
  listReviewRecords
} from "../../infra/persistence/in-memory-store";

interface SearchListingsInput {
  ownerId?: string;
  status?: "ACTIVE" | "PENDING_VALIDATION" | "FLAGGED" | "SUSPENDED" | "ARCHIVED";
  category?: string;
  city?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  deliveryMode?: "PICKUP" | "DELIVERY";
  bookingMode?: "IMMEDIATE" | "SCHEDULED";
  minRating?: number;
  availableFrom?: Date;
  availableTo?: Date;
}

interface ListingWithRating {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category?: string;
  city?: string;
  region?: string;
  dailyPrice: number;
  deliveryMode: "PICKUP" | "DELIVERY" | "BOTH";
  bookingMode: "IMMEDIATE" | "SCHEDULED" | "BOTH";
  status: "ACTIVE" | "PENDING_VALIDATION" | "FLAGGED" | "SUSPENDED" | "ARCHIVED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  averageRating: number;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeText(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function toUtcDateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function buildDateRangeDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);

  while (current < end) {
    days.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

function hasRentalConflict(input: {
  listingId: string;
  start: Date;
  end: Date;
  rentals: Array<{
    listingId: string;
    startDate: Date;
    endDate: Date;
    status: "REQUESTED" | "APPROVED" | "ACTIVE" | "COMPLETED" | "CANCELED" | "DISPUTED";
  }>;
}): boolean {
  const blockingStatuses = new Set(["REQUESTED", "APPROVED", "ACTIVE"]);

  return input.rentals.some((rental) => {
    if (rental.listingId !== input.listingId) {
      return false;
    }

    if (!blockingStatuses.has(rental.status)) {
      return false;
    }

    return input.start < rental.endDate && input.end > rental.startDate;
  });
}

export async function searchListings(input: SearchListingsInput): Promise<ListingWithRating[]> {
  if (input.availableFrom && input.availableTo) {
    ensureValidAvailabilityRange({
      start: input.availableFrom,
      end: input.availableTo
    });
  }

  const normalizedCategory = normalizeText(input.category);
  const normalizedCity = normalizeText(input.city);
  const normalizedRegion = normalizeText(input.region);

  const [baseListings, reviews, rentals, availabilitySlots] = await Promise.all([
    input.ownerId ? listListingsByOwner(input.ownerId) : listListingRecords(),
    listReviewRecords(),
    listRentalRecords(),
    listListingAvailabilityRecords()
  ]);

  const ratingByListing = new Map<string, { sum: number; count: number }>();
  for (const review of reviews) {
    const existing = ratingByListing.get(review.listingId) ?? { sum: 0, count: 0 };
    existing.sum += review.rating;
    existing.count += 1;
    ratingByListing.set(review.listingId, existing);
  }

  const slotsByListing = new Map<string, typeof availabilitySlots>();
  for (const slot of availabilitySlots) {
    const list = slotsByListing.get(slot.listingId) ?? [];
    list.push(slot);
    slotsByListing.set(slot.listingId, list);
  }

  const requestedStart = input.availableFrom ? toUtcDateOnly(input.availableFrom) : undefined;
  const requestedEnd = input.availableTo ? toUtcDateOnly(input.availableTo) : undefined;
  const requestedDays =
    requestedStart && requestedEnd ? buildDateRangeDays(requestedStart, requestedEnd) : [];

  return baseListings
    .filter((listing) => {
      if (input.status && listing.status !== input.status) {
        return false;
      }

      if (normalizedCategory) {
        const listingCategory = normalizeText(listing.category);
        if (!listingCategory || !listingCategory.includes(normalizedCategory)) {
          return false;
        }
      }

      if (normalizedCity) {
        const listingCity = normalizeText(listing.city);
        if (!listingCity || !listingCity.includes(normalizedCity)) {
          return false;
        }
      }

      if (normalizedRegion) {
        const listingRegion = normalizeText(listing.region);
        if (!listingRegion || !listingRegion.includes(normalizedRegion)) {
          return false;
        }
      }

      if (input.minPrice !== undefined && listing.dailyPrice < input.minPrice) {
        return false;
      }

      if (input.maxPrice !== undefined && listing.dailyPrice > input.maxPrice) {
        return false;
      }

      if (input.deliveryMode && !supportsRequestedDeliveryMode(listing.deliveryMode, input.deliveryMode)) {
        return false;
      }

      if (input.bookingMode && !supportsRequestedBookingMode(listing.bookingMode, input.bookingMode)) {
        return false;
      }

      const rating = ratingByListing.get(listing.id);
      const averageRating = rating && rating.count > 0 ? rating.sum / rating.count : 0;

      if (input.minRating !== undefined && averageRating < input.minRating) {
        return false;
      }

      if (requestedStart && requestedEnd) {
        if (listing.status !== "ACTIVE") {
          return false;
        }

        if (
          hasRentalConflict({
            listingId: listing.id,
            start: requestedStart,
            end: requestedEnd,
            rentals
          })
        ) {
          return false;
        }

        const listingSlots = slotsByListing.get(listing.id) ?? [];
        if (listingSlots.length > 0) {
          const slotByDate = new Map(listingSlots.map((slot) => [toUtcDateOnly(slot.date).toISOString(), slot]));

          const allDaysAvailable = requestedDays.every((day) => {
            const slot = slotByDate.get(day.toISOString());
            return Boolean(slot && canTreatSlotAsAvailable(slot.status));
          });

          if (!allDaysAvailable) {
            return false;
          }
        }
      }

      return true;
    })
    .map((listing) => {
      const rating = ratingByListing.get(listing.id);
      const averageRating = rating && rating.count > 0 ? rating.sum / rating.count : 0;

      return {
        ...listing,
        averageRating: Number(averageRating.toFixed(2))
      };
    });
}
