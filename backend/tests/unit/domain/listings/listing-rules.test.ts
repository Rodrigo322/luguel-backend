import { describe, expect, it } from "vitest";
import {
  ensureListingCanBeArchived,
  ensureListingCanBeEdited,
  ensureListingWriteAccess,
  ensureValidDailyPrice,
  resolveListingStatusFromRisk
} from "../../../../src/domain/listings/services/listing-rules";

describe("listing-rules", () => {
  it("should map high and critical risk to pending validation", () => {
    expect(resolveListingStatusFromRisk("HIGH")).toBe("PENDING_VALIDATION");
    expect(resolveListingStatusFromRisk("CRITICAL")).toBe("PENDING_VALIDATION");
    expect(resolveListingStatusFromRisk("LOW")).toBe("ACTIVE");
  });

  it("should block invalid write access", () => {
    expect(() =>
      ensureListingWriteAccess({
        actorId: "user-2",
        actorRole: "LOCATARIO",
        ownerId: "user-1"
      })
    ).toThrowError(/Only listing owner or admin/);
  });

  it("should validate daily price and editable/archive states", () => {
    expect(() => ensureValidDailyPrice(0)).toThrowError(/Daily price/);
    expect(() => ensureListingCanBeEdited("SUSPENDED")).toThrowError(/cannot be edited/);
    expect(() => ensureListingCanBeArchived("ARCHIVED")).toThrowError(/already archived/);
  });
});
