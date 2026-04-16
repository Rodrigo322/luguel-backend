import { describe, expect, it } from "vitest";
import {
  ensureBoostAmountIsValid,
  ensureBoostDurationIsValid,
  ensureBoostPaymentConfirmed,
  ensureBoostWriteAccess
} from "../../../../src/domain/boost/services/boost-rules";

describe("boost-rules", () => {
  it("should validate payment, amount and duration", () => {
    expect(() => ensureBoostPaymentConfirmed(false)).toThrowError(/Payment confirmation/);
    expect(() => ensureBoostAmountIsValid(0)).toThrowError(/greater than zero/);
    expect(() => ensureBoostDurationIsValid(45)).toThrowError(/between 1 and 30/);
  });

  it("should validate boost write access", () => {
    expect(() =>
      ensureBoostWriteAccess({
        requesterId: "user-2",
        requesterRole: "LOCATARIO",
        listingOwnerId: "user-1"
      })
    ).toThrowError(/Only listing owner or admin/);
  });
});
