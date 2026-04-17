import { describe, expect, it } from "vitest";
import {
  calculateRentalDays,
  ensureNotSelfRental,
  ensureRentalReadAccess,
  ensureRentalStatusTransition,
  ensureValidRentalPeriod
} from "../../../../src/domain/rentals/services/rental-rules";

describe("rental-rules", () => {
  it("should calculate rental days with minimum of one day", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-01-01T12:00:00.000Z");
    expect(calculateRentalDays(start, end)).toBe(1);
  });

  it("should validate rental period and self-rental", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(() => ensureValidRentalPeriod(date, date)).toThrowError(/Invalid rental period/);
    expect(() => ensureNotSelfRental("same-user", "same-user")).toThrowError(/Owner cannot rent/);
  });

  it("should enforce transition and read access", () => {
    expect(() => ensureRentalStatusTransition("REQUESTED", "COMPLETED")).toThrowError(/Invalid rental status/);

    expect(() =>
      ensureRentalReadAccess({
        requesterId: "user-c",
        requesterRole: "LOCATARIO",
        rentalTenantId: "user-a",
        listingOwnerId: "user-b"
      })
    ).toThrowError(/not allowed/);
  });
});
