export type ListingStatus = "ACTIVE" | "PENDING_VALIDATION" | "FLAGGED" | "SUSPENDED" | "ARCHIVED";

export interface Listing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  dailyPrice: number;
  status: ListingStatus;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}
