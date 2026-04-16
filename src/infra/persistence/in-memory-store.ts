import { env } from "../../shared/config/env";
import { memoryStore } from "./memory-store";
import { prismaStore } from "./prisma-store";
import type {
  PersistenceStore,
  StoredAdminAuditLog,
  StoredBoost,
  StoredListing,
  StoredRental,
  StoredReport,
  StoredReview,
  StoredRiskAssessment,
  StoredUser
} from "./store-types";

const persistenceDriver = env.NODE_ENV === "test" ? "memory" : (env.PERSISTENCE_DRIVER ?? "prisma");
const store: PersistenceStore = persistenceDriver === "prisma" ? prismaStore : memoryStore;

export type {
  PersistenceStore,
  StoredAdminAuditLog,
  StoredBoost,
  StoredListing,
  StoredRental,
  StoredReport,
  StoredReview,
  StoredRiskAssessment,
  StoredUser
};

export async function resetInMemoryStore(): Promise<void> {
  await store.reset();
}

export async function upsertUserFromAuth(input: { id: string; email: string; name: string }): Promise<StoredUser> {
  return store.upsertUserFromAuth(input);
}

export async function getUserById(userId: string): Promise<StoredUser | null> {
  return store.getUserById(userId);
}

export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  return store.getUserByEmail(email);
}

export async function updateUserRole(
  userId: string,
  role: Extract<StoredUser["role"], "LOCADOR" | "LOCATARIO">
): Promise<StoredUser | null> {
  return store.updateUserRole(userId, role);
}

export async function updateUserReputation(userId: string, rating: number): Promise<StoredUser | null> {
  return store.updateUserReputation(userId, rating);
}

export async function createListingRecord(input: {
  ownerId: string;
  title: string;
  description: string;
  dailyPrice: number;
  status: StoredListing["status"];
  riskLevel: StoredListing["riskLevel"];
}): Promise<StoredListing> {
  return store.createListingRecord(input);
}

export async function listListingRecords(): Promise<StoredListing[]> {
  return store.listListingRecords();
}

export async function getListingById(listingId: string): Promise<StoredListing | null> {
  return store.getListingById(listingId);
}

export async function updateListingStatus(
  listingId: string,
  status: StoredListing["status"]
): Promise<StoredListing | null> {
  return store.updateListingStatus(listingId, status);
}

export async function createRiskAssessmentRecord(input: {
  userId?: string;
  listingId?: string;
  score: number;
  level: StoredRiskAssessment["level"];
  reasons: string[];
}): Promise<StoredRiskAssessment> {
  return store.createRiskAssessmentRecord(input);
}

export async function createRentalRecord(input: {
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: StoredRental["status"];
}): Promise<StoredRental> {
  return store.createRentalRecord(input);
}

export async function getRentalById(rentalId: string): Promise<StoredRental | null> {
  return store.getRentalById(rentalId);
}

export async function updateRentalStatus(
  rentalId: string,
  status: StoredRental["status"]
): Promise<StoredRental | null> {
  return store.updateRentalStatus(rentalId, status);
}

export async function findReviewByRentalAndReviewer(
  rentalId: string,
  reviewerId: string
): Promise<StoredReview | null> {
  return store.findReviewByRentalAndReviewer(rentalId, reviewerId);
}

export async function createReviewRecord(input: {
  listingId: string;
  rentalId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
  comment?: string;
}): Promise<StoredReview> {
  return store.createReviewRecord(input);
}

export async function createReportRecord(input: {
  reporterId: string;
  listingId?: string;
  rentalId?: string;
  reason: string;
  details?: string;
  riskLevel: StoredReport["riskLevel"];
  status?: StoredReport["status"];
}): Promise<StoredReport> {
  return store.createReportRecord(input);
}

export async function listReportRecords(): Promise<StoredReport[]> {
  return store.listReportRecords();
}

export async function listCriticalOpenReports(): Promise<StoredReport[]> {
  return store.listCriticalOpenReports();
}

export async function getReportById(reportId: string): Promise<StoredReport | null> {
  return store.getReportById(reportId);
}

export async function updateReportStatus(
  reportId: string,
  status: StoredReport["status"]
): Promise<StoredReport | null> {
  return store.updateReportStatus(reportId, status);
}

export async function createAdminAuditLogRecord(input: {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<StoredAdminAuditLog> {
  return store.createAdminAuditLogRecord(input);
}

export async function createBoostRecord(input: {
  listingId: string;
  status: StoredBoost["status"];
  amount: number;
  startsAt: Date;
  endsAt: Date;
}): Promise<StoredBoost> {
  return store.createBoostRecord(input);
}
