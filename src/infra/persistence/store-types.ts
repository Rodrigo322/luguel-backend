import type { ListingStatus } from "../../domain/listings/entities/listing";
import type { RentalStatus } from "../../domain/rentals/entities/rental";
import type { ReportStatus } from "../../domain/reports/entities/report";
import type { BoostStatus } from "../../domain/boost/entities/boost";
import type { RiskLevel } from "../../domain/shared/risk/risk-level";
import type { UserRole } from "../../shared/types/role";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isBanned: boolean;
  bannedAt?: Date;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredListing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  dailyPrice: number;
  status: ListingStatus;
  riskLevel: RiskLevel;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredRental {
  id: string;
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: RentalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredReview {
  id: string;
  listingId: string;
  rentalId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}

export interface StoredReport {
  id: string;
  reporterId: string;
  listingId?: string;
  rentalId?: string;
  reason: string;
  details?: string;
  status: ReportStatus;
  riskLevel: RiskLevel;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredBoost {
  id: string;
  listingId: string;
  status: BoostStatus;
  amount: number;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredRiskAssessment {
  id: string;
  userId?: string;
  listingId?: string;
  score: number;
  level: RiskLevel;
  reasons: string[];
  createdAt: Date;
}

export interface StoredAdminAuditLog {
  id: string;
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface PersistenceStore {
  reset(): Promise<void>;

  upsertUserFromAuth(input: { id: string; email: string; name: string }): Promise<StoredUser>;
  listUsers(): Promise<StoredUser[]>;
  getUserById(userId: string): Promise<StoredUser | null>;
  getUserByEmail(email: string): Promise<StoredUser | null>;
  updateUserProfile(userId: string, input: { name: string }): Promise<StoredUser | null>;
  updateUserRole(userId: string, role: Extract<UserRole, "LOCADOR" | "LOCATARIO">): Promise<StoredUser | null>;
  banUser(userId: string): Promise<StoredUser | null>;
  deleteUserById(userId: string): Promise<boolean>;
  updateUserReputation(userId: string, rating: number): Promise<StoredUser | null>;

  createListingRecord(input: {
    ownerId: string;
    title: string;
    description: string;
    dailyPrice: number;
    status: ListingStatus;
    riskLevel: RiskLevel;
  }): Promise<StoredListing>;
  listListingRecords(): Promise<StoredListing[]>;
  listListingsByOwner(ownerId: string): Promise<StoredListing[]>;
  getListingById(listingId: string): Promise<StoredListing | null>;
  updateListingRecord(
    listingId: string,
    input: Partial<{
      title: string;
      description: string;
      dailyPrice: number;
      status: ListingStatus;
      riskLevel: RiskLevel;
    }>
  ): Promise<StoredListing | null>;
  updateListingStatus(listingId: string, status: ListingStatus): Promise<StoredListing | null>;

  createRiskAssessmentRecord(input: {
    userId?: string;
    listingId?: string;
    score: number;
    level: RiskLevel;
    reasons: string[];
  }): Promise<StoredRiskAssessment>;

  createRentalRecord(input: {
    listingId: string;
    tenantId: string;
    startDate: Date;
    endDate: Date;
    totalPrice: number;
    status: RentalStatus;
  }): Promise<StoredRental>;
  getRentalById(rentalId: string): Promise<StoredRental | null>;
  listRentalRecords(): Promise<StoredRental[]>;
  listRentalsByUser(userId: string): Promise<StoredRental[]>;
  updateRentalStatus(rentalId: string, status: RentalStatus): Promise<StoredRental | null>;

  findReviewByRentalAndReviewer(rentalId: string, reviewerId: string): Promise<StoredReview | null>;
  createReviewRecord(input: {
    listingId: string;
    rentalId: string;
    reviewerId: string;
    reviewedId: string;
    rating: number;
    comment?: string;
  }): Promise<StoredReview>;

  createReportRecord(input: {
    reporterId: string;
    listingId?: string;
    rentalId?: string;
    reason: string;
    details?: string;
    riskLevel: RiskLevel;
    status?: ReportStatus;
  }): Promise<StoredReport>;
  listReportRecords(): Promise<StoredReport[]>;
  listCriticalOpenReports(): Promise<StoredReport[]>;
  getReportById(reportId: string): Promise<StoredReport | null>;
  updateReportStatus(reportId: string, status: ReportStatus): Promise<StoredReport | null>;

  createAdminAuditLogRecord(input: {
    adminId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<StoredAdminAuditLog>;

  createBoostRecord(input: {
    listingId: string;
    status: BoostStatus;
    amount: number;
    startsAt: Date;
    endsAt: Date;
  }): Promise<StoredBoost>;
}
