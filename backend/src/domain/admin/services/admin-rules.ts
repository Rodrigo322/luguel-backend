import { DomainError } from "../../shared/errors/domain-error";
import type { RiskLevel } from "../../shared/risk/risk-level";
import type { ReportStatus } from "../../reports/entities/report";
import type { ListingStatus } from "../../listings/entities/listing";

export function ensureListingIsCriticalCase(listingRiskLevel: RiskLevel): void {
  if (listingRiskLevel !== "CRITICAL") {
    throw new DomainError("Admin intervention is allowed only for critical listings.", 400, "NotCriticalCase");
  }
}

export function ensureCanBanUser(isAlreadyBanned: boolean): void {
  if (isAlreadyBanned) {
    throw new DomainError("User is already banned.", 400, "UserAlreadyBanned");
  }
}

export function ensureListingCanBeModerated(currentStatus: ListingStatus): void {
  if (currentStatus === "ARCHIVED") {
    throw new DomainError("Listing is already archived.", 400, "ListingAlreadyArchived");
  }
}

export function ensureReportReviewStatus(status: ReportStatus): void {
  if (status === "OPEN") {
    throw new DomainError("Admin review status must resolve or triage report.", 400, "InvalidReviewStatus");
  }
}
