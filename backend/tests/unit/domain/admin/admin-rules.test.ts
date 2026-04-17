import { describe, expect, it } from "vitest";
import {
  ensureCanBanUser,
  ensureListingCanBeModerated,
  ensureListingIsCriticalCase,
  ensureReportReviewStatus
} from "../../../../src/domain/admin/services/admin-rules";

describe("admin-rules", () => {
  it("should enforce critical case moderation", () => {
    expect(() => ensureListingIsCriticalCase("HIGH")).toThrowError(/critical listings/);
  });

  it("should validate ban/listing moderation/report review", () => {
    expect(() => ensureCanBanUser(true)).toThrowError(/already banned/);
    expect(() => ensureListingCanBeModerated("ARCHIVED")).toThrowError(/already archived/);
    expect(() => ensureReportReviewStatus("OPEN")).toThrowError(/must resolve or triage/);
  });
});
