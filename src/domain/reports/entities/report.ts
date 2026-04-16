export type ReportStatus = "OPEN" | "TRIAGED" | "RESOLVED" | "REJECTED";

export interface Report {
  id: string;
  reporterId: string;
  listingId?: string;
  rentalId?: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}
