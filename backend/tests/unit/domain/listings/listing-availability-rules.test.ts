import { describe, expect, it } from "vitest";
import {
  ensureAvailabilitySlotDate,
  ensureUniqueAvailabilityDates,
  ensureValidAvailabilityTime,
  supportsRequestedBookingMode,
  supportsRequestedDeliveryMode
} from "../../../../src/domain/listings/services/listing-availability-rules";

describe("listing availability rules", () => {
  it("should normalize availability date to utc day", () => {
    const normalized = ensureAvailabilitySlotDate(new Date("2026-10-10T13:22:00.000Z"));
    expect(normalized.toISOString()).toBe("2026-10-10T00:00:00.000Z");
  });

  it("should reject invalid pickup/return sequence", () => {
    expect(() =>
      ensureValidAvailabilityTime({
        pickupTime: "18:00",
        returnTime: "09:00"
      })
    ).toThrowError(/Return time must be after pickup time/);
  });

  it("should reject duplicated dates", () => {
    const day = new Date("2026-10-11T00:00:00.000Z");
    expect(() => ensureUniqueAvailabilityDates([day, day])).toThrowError(/cannot be duplicated/i);
  });

  it("should support inclusive modes for delivery and booking", () => {
    expect(supportsRequestedDeliveryMode("BOTH", "PICKUP")).toBe(true);
    expect(supportsRequestedDeliveryMode("DELIVERY", "PICKUP")).toBe(false);
    expect(supportsRequestedBookingMode("BOTH", "IMMEDIATE")).toBe(true);
    expect(supportsRequestedBookingMode("SCHEDULED", "IMMEDIATE")).toBe(false);
  });
});
