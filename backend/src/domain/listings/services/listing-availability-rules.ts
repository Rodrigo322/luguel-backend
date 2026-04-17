import { DomainError } from "../../shared/errors/domain-error";
import type {
  ListingBookingMode,
  ListingDeliveryMode
} from "../entities/listing";
import type { ListingAvailabilityStatus } from "../entities/listing-availability";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function ensureValidListingCategory(category?: string): string | undefined {
  const normalized = category?.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length < 2 || normalized.length > 80) {
    throw new DomainError("Category must have between 2 and 80 characters.", 400, "InvalidListingCategory");
  }

  return normalized;
}

export function ensureValidListingCity(city?: string): string | undefined {
  const normalized = city?.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length < 2 || normalized.length > 80) {
    throw new DomainError("City must have between 2 and 80 characters.", 400, "InvalidListingCity");
  }

  return normalized;
}

export function ensureValidListingRegion(region?: string): string | undefined {
  const normalized = region?.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length < 2 || normalized.length > 120) {
    throw new DomainError("Region must have between 2 and 120 characters.", 400, "InvalidListingRegion");
  }

  return normalized;
}

export function ensureValidListingDeliveryMode(
  deliveryMode?: ListingDeliveryMode
): ListingDeliveryMode {
  return deliveryMode ?? "BOTH";
}

export function ensureValidListingBookingMode(
  bookingMode?: ListingBookingMode
): ListingBookingMode {
  return bookingMode ?? "BOTH";
}

export function ensureValidAvailabilityRange(input: { start: Date; end: Date }): void {
  if (input.start >= input.end) {
    throw new DomainError("Availability range is invalid.", 400, "InvalidAvailabilityRange");
  }
}

export function ensureValidAvailabilityTime(input: { pickupTime: string; returnTime: string }): void {
  if (!TIME_PATTERN.test(input.pickupTime) || !TIME_PATTERN.test(input.returnTime)) {
    throw new DomainError("Pickup and return times must follow HH:mm format.", 400, "InvalidAvailabilityTime");
  }

  if (toMinutes(input.pickupTime) >= toMinutes(input.returnTime)) {
    throw new DomainError("Return time must be after pickup time.", 400, "InvalidAvailabilityTimeRange");
  }
}

export function ensureAvailabilitySlotDate(value: Date): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainError("Availability date is invalid.", 400, "InvalidAvailabilityDate");
  }

  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function ensureUniqueAvailabilityDates(dates: Date[]): void {
  const keySet = new Set(dates.map((date) => date.toISOString()));

  if (keySet.size !== dates.length) {
    throw new DomainError("Availability dates cannot be duplicated.", 400, "DuplicatedAvailabilityDate");
  }
}

export function supportsRequestedDeliveryMode(
  listingMode: ListingDeliveryMode,
  requestedMode: "PICKUP" | "DELIVERY"
): boolean {
  if (listingMode === "BOTH") {
    return true;
  }

  return listingMode === requestedMode;
}

export function supportsRequestedBookingMode(
  listingMode: ListingBookingMode,
  requestedMode: "IMMEDIATE" | "SCHEDULED"
): boolean {
  if (listingMode === "BOTH") {
    return true;
  }

  return listingMode === requestedMode;
}

export function canTreatSlotAsAvailable(status: ListingAvailabilityStatus): boolean {
  return status === "FREE";
}
