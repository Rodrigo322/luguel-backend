import {
  listBoostRecords,
  listListingRecords,
  listRentalRecords,
  listReportRecords,
  listUsers
} from "../../infra/persistence/in-memory-store";

export interface AdminMetrics {
  totalUsers: number;
  totalListings: number;
  totalRentals: number;
  totalReports: number;
  criticalReports: number;
  highRiskListings: number;
  pendingListings: number;
  activeBoosts: number;
  bannedUsers: number;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [users, listings, rentals, reports, boosts] = await Promise.all([
    listUsers(),
    listListingRecords(),
    listRentalRecords(),
    listReportRecords(),
    listBoostRecords()
  ]);

  return {
    totalUsers: users.length,
    totalListings: listings.length,
    totalRentals: rentals.length,
    totalReports: reports.filter((report) => report.status === "OPEN").length,
    criticalReports: reports.filter((report) => report.status === "OPEN" && report.riskLevel === "CRITICAL")
      .length,
    highRiskListings: listings.filter(
      (listing) => listing.riskLevel === "HIGH" || listing.riskLevel === "CRITICAL"
    ).length,
    pendingListings: listings.filter((listing) => listing.status === "PENDING_VALIDATION").length,
    activeBoosts: boosts.filter((boost) => boost.status === "ACTIVE").length,
    bannedUsers: users.filter((user) => user.isBanned).length
  };
}
