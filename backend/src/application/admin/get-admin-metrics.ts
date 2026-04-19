import {
  getRentalPaymentByRentalId,
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
  verifiedUsers: number;
  premiumAdvertisers: number;
  totalCommissionRevenue: number;
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [users, listings, rentals, reports, boosts] = await Promise.all([
    listUsers(),
    listListingRecords(),
    listRentalRecords(),
    listReportRecords(),
    listBoostRecords()
  ]);

  const payments = await Promise.all(rentals.map((rental) => getRentalPaymentByRentalId(rental.id)));
  const totalCommissionRevenue = payments.reduce((total, payment) => {
    if (!payment) {
      return total;
    }

    if (payment.status === "PAID") {
      return total + payment.platformFeeAmount;
    }

    if (payment.status === "PARTIALLY_PAID" && payment.totalAmount > 0) {
      return total + payment.platformFeeAmount * Math.min(1, payment.paidAmount / payment.totalAmount);
    }

    return total;
  }, 0);

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
    bannedUsers: users.filter((user) => user.isBanned).length,
    verifiedUsers: users.filter((user) => user.identityVerificationStatus === "VERIFIED").length,
    premiumAdvertisers: users.filter((user) => user.role === "LOCADOR" && user.plan === "PREMIUM").length,
    totalCommissionRevenue: Math.round((totalCommissionRevenue + Number.EPSILON) * 100) / 100
  };
}
