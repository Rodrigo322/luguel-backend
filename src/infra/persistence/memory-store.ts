import { randomUUID } from "node:crypto";
import { env } from "../../shared/config/env";
import type { UserRole } from "../../shared/types/role";
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

const adminEmails = new Set(
  env.ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const usersById = new Map<string, StoredUser>();
const usersByEmail = new Map<string, StoredUser>();
const listingsById = new Map<string, StoredListing>();
const rentalsById = new Map<string, StoredRental>();
const reviewsById = new Map<string, StoredReview>();
const reportsById = new Map<string, StoredReport>();
const boostsById = new Map<string, StoredBoost>();
const riskAssessmentsById = new Map<string, StoredRiskAssessment>();
const adminAuditLogsById = new Map<string, StoredAdminAuditLog>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function reset(): Promise<void> {
  usersById.clear();
  usersByEmail.clear();
  listingsById.clear();
  rentalsById.clear();
  reviewsById.clear();
  reportsById.clear();
  boostsById.clear();
  riskAssessmentsById.clear();
  adminAuditLogsById.clear();
}

async function upsertUserFromAuth(input: { id: string; email: string; name: string }): Promise<StoredUser> {
  const email = normalizeEmail(input.email);
  const now = new Date();

  const existing = usersById.get(input.id) ?? usersByEmail.get(email);

  if (existing) {
    const updated: StoredUser = {
      ...existing,
      name: input.name,
      email,
      updatedAt: now
    };
    usersById.set(updated.id, updated);
    usersByEmail.set(email, updated);
    return updated;
  }

  const created: StoredUser = {
    id: input.id,
    email,
    name: input.name,
    role: adminEmails.has(email) ? "ADMIN" : "LOCATARIO",
    isBanned: false,
    bannedAt: undefined,
    reputationScore: 0,
    createdAt: now,
    updatedAt: now
  };

  usersById.set(created.id, created);
  usersByEmail.set(email, created);

  return created;
}

async function getUserById(userId: string): Promise<StoredUser | null> {
  return usersById.get(userId) ?? null;
}

async function listUsers(): Promise<StoredUser[]> {
  return [...usersById.values()];
}

async function getUserByEmail(email: string): Promise<StoredUser | null> {
  return usersByEmail.get(normalizeEmail(email)) ?? null;
}

async function updateUserProfile(userId: string, input: { name: string }): Promise<StoredUser | null> {
  const existing = usersById.get(userId);

  if (!existing) {
    return null;
  }

  const updated: StoredUser = {
    ...existing,
    name: input.name,
    updatedAt: new Date()
  };

  usersById.set(updated.id, updated);
  usersByEmail.set(updated.email, updated);

  return updated;
}

async function updateUserRole(
  userId: string,
  role: Extract<UserRole, "LOCADOR" | "LOCATARIO">
): Promise<StoredUser | null> {
  const existing = usersById.get(userId);

  if (!existing) {
    return null;
  }

  const updated: StoredUser = {
    ...existing,
    role,
    updatedAt: new Date()
  };

  usersById.set(updated.id, updated);
  usersByEmail.set(updated.email, updated);

  return updated;
}

async function banUser(userId: string): Promise<StoredUser | null> {
  const existing = usersById.get(userId);

  if (!existing) {
    return null;
  }

  const updated: StoredUser = {
    ...existing,
    isBanned: true,
    bannedAt: existing.bannedAt ?? new Date(),
    updatedAt: new Date()
  };

  usersById.set(updated.id, updated);
  usersByEmail.set(updated.email, updated);

  return updated;
}

async function deleteUserById(userId: string): Promise<boolean> {
  const existing = usersById.get(userId);

  if (!existing) {
    return false;
  }

  usersById.delete(userId);
  usersByEmail.delete(existing.email);

  return true;
}

async function updateUserReputation(userId: string, rating: number): Promise<StoredUser | null> {
  const existing = usersById.get(userId);

  if (!existing) {
    return null;
  }

  const reputationDelta = rating * 2 - 5;
  const updatedReputation = Math.max(0, existing.reputationScore + reputationDelta);

  const updated: StoredUser = {
    ...existing,
    reputationScore: updatedReputation,
    updatedAt: new Date()
  };

  usersById.set(updated.id, updated);
  usersByEmail.set(updated.email, updated);

  return updated;
}

async function createListingRecord(input: {
  ownerId: string;
  title: string;
  description: string;
  dailyPrice: number;
  status: StoredListing["status"];
  riskLevel: StoredListing["riskLevel"];
}): Promise<StoredListing> {
  const now = new Date();
  const listing: StoredListing = {
    id: randomUUID(),
    ownerId: input.ownerId,
    title: input.title,
    description: input.description,
    dailyPrice: input.dailyPrice,
    status: input.status,
    riskLevel: input.riskLevel,
    createdAt: now,
    updatedAt: now
  };

  listingsById.set(listing.id, listing);

  return listing;
}

async function listListingRecords(): Promise<StoredListing[]> {
  return [...listingsById.values()];
}

async function listListingsByOwner(ownerId: string): Promise<StoredListing[]> {
  return [...listingsById.values()].filter((listing) => listing.ownerId === ownerId);
}

async function getListingById(listingId: string): Promise<StoredListing | null> {
  return listingsById.get(listingId) ?? null;
}

async function updateListingRecord(
  listingId: string,
  input: Partial<{
    title: string;
    description: string;
    dailyPrice: number;
    status: StoredListing["status"];
    riskLevel: StoredListing["riskLevel"];
  }>
): Promise<StoredListing | null> {
  const existing = listingsById.get(listingId);

  if (!existing) {
    return null;
  }

  const updated: StoredListing = {
    ...existing,
    ...input,
    updatedAt: new Date()
  };

  listingsById.set(updated.id, updated);

  return updated;
}

async function updateListingStatus(listingId: string, status: StoredListing["status"]): Promise<StoredListing | null> {
  const existing = listingsById.get(listingId);

  if (!existing) {
    return null;
  }

  const updated: StoredListing = {
    ...existing,
    status,
    updatedAt: new Date()
  };

  listingsById.set(updated.id, updated);

  return updated;
}

async function createRiskAssessmentRecord(input: {
  userId?: string;
  listingId?: string;
  score: number;
  level: StoredRiskAssessment["level"];
  reasons: string[];
}): Promise<StoredRiskAssessment> {
  const riskAssessment: StoredRiskAssessment = {
    id: randomUUID(),
    userId: input.userId,
    listingId: input.listingId,
    score: input.score,
    level: input.level,
    reasons: input.reasons,
    createdAt: new Date()
  };

  riskAssessmentsById.set(riskAssessment.id, riskAssessment);

  return riskAssessment;
}

async function createRentalRecord(input: {
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: StoredRental["status"];
}): Promise<StoredRental> {
  const now = new Date();
  const rental: StoredRental = {
    id: randomUUID(),
    listingId: input.listingId,
    tenantId: input.tenantId,
    startDate: input.startDate,
    endDate: input.endDate,
    totalPrice: input.totalPrice,
    status: input.status,
    createdAt: now,
    updatedAt: now
  };

  rentalsById.set(rental.id, rental);

  return rental;
}

async function getRentalById(rentalId: string): Promise<StoredRental | null> {
  return rentalsById.get(rentalId) ?? null;
}

async function listRentalRecords(): Promise<StoredRental[]> {
  return [...rentalsById.values()];
}

async function listRentalsByUser(userId: string): Promise<StoredRental[]> {
  return [...rentalsById.values()].filter((rental) => {
    if (rental.tenantId === userId) {
      return true;
    }

    const listing = listingsById.get(rental.listingId);
    return listing?.ownerId === userId;
  });
}

async function updateRentalStatus(rentalId: string, status: StoredRental["status"]): Promise<StoredRental | null> {
  const existing = rentalsById.get(rentalId);

  if (!existing) {
    return null;
  }

  const updated: StoredRental = {
    ...existing,
    status,
    updatedAt: new Date()
  };

  rentalsById.set(updated.id, updated);

  return updated;
}

async function findReviewByRentalAndReviewer(
  rentalId: string,
  reviewerId: string
): Promise<StoredReview | null> {
  return (
    [...reviewsById.values()].find((review) => review.rentalId === rentalId && review.reviewerId === reviewerId) ??
    null
  );
}

async function createReviewRecord(input: {
  listingId: string;
  rentalId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
  comment?: string;
}): Promise<StoredReview> {
  const review: StoredReview = {
    id: randomUUID(),
    listingId: input.listingId,
    rentalId: input.rentalId,
    reviewerId: input.reviewerId,
    reviewedId: input.reviewedId,
    rating: input.rating,
    comment: input.comment,
    createdAt: new Date()
  };

  reviewsById.set(review.id, review);
  await updateUserReputation(input.reviewedId, input.rating);

  return review;
}

async function createReportRecord(input: {
  reporterId: string;
  listingId?: string;
  rentalId?: string;
  reason: string;
  details?: string;
  riskLevel: StoredReport["riskLevel"];
  status?: StoredReport["status"];
}): Promise<StoredReport> {
  const now = new Date();
  const report: StoredReport = {
    id: randomUUID(),
    reporterId: input.reporterId,
    listingId: input.listingId,
    rentalId: input.rentalId,
    reason: input.reason,
    details: input.details,
    status: input.status ?? "OPEN",
    riskLevel: input.riskLevel,
    createdAt: now,
    updatedAt: now
  };

  reportsById.set(report.id, report);

  return report;
}

async function listReportRecords(): Promise<StoredReport[]> {
  return [...reportsById.values()];
}

async function listCriticalOpenReports(): Promise<StoredReport[]> {
  return [...reportsById.values()].filter(
    (report) => report.status === "OPEN" && report.riskLevel === "CRITICAL"
  );
}

async function getReportById(reportId: string): Promise<StoredReport | null> {
  return reportsById.get(reportId) ?? null;
}

async function updateReportStatus(reportId: string, status: StoredReport["status"]): Promise<StoredReport | null> {
  const existing = reportsById.get(reportId);

  if (!existing) {
    return null;
  }

  const updated: StoredReport = {
    ...existing,
    status,
    updatedAt: new Date()
  };

  reportsById.set(updated.id, updated);

  return updated;
}

async function createAdminAuditLogRecord(input: {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<StoredAdminAuditLog> {
  const auditLog: StoredAdminAuditLog = {
    id: randomUUID(),
    adminId: input.adminId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata,
    createdAt: new Date()
  };

  adminAuditLogsById.set(auditLog.id, auditLog);

  return auditLog;
}

async function createBoostRecord(input: {
  listingId: string;
  status: StoredBoost["status"];
  amount: number;
  startsAt: Date;
  endsAt: Date;
}): Promise<StoredBoost> {
  const now = new Date();
  const boost: StoredBoost = {
    id: randomUUID(),
    listingId: input.listingId,
    status: input.status,
    amount: input.amount,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    createdAt: now,
    updatedAt: now
  };

  boostsById.set(boost.id, boost);

  return boost;
}

export const memoryStore: PersistenceStore = {
  reset,
  upsertUserFromAuth,
  listUsers,
  getUserById,
  getUserByEmail,
  updateUserProfile,
  updateUserRole,
  banUser,
  deleteUserById,
  updateUserReputation,
  createListingRecord,
  listListingRecords,
  listListingsByOwner,
  getListingById,
  updateListingRecord,
  updateListingStatus,
  createRiskAssessmentRecord,
  createRentalRecord,
  getRentalById,
  listRentalRecords,
  listRentalsByUser,
  updateRentalStatus,
  findReviewByRentalAndReviewer,
  createReviewRecord,
  createReportRecord,
  listReportRecords,
  listCriticalOpenReports,
  getReportById,
  updateReportStatus,
  createAdminAuditLogRecord,
  createBoostRecord
};
