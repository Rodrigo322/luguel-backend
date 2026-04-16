import { randomUUID } from "node:crypto";
import type { UserRole } from "../../shared/types/role";
import { env } from "../../shared/config/env";
import type { ListingStatus } from "../../domain/listings/entities/listing";
import type { RentalStatus } from "../../domain/rentals/entities/rental";
import type { ReportStatus } from "../../domain/reports/entities/report";
import type { BoostStatus } from "../../domain/boost/entities/boost";
import type { RiskLevel } from "../../domain/shared/risk/risk-level";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthUserInput {
  id: string;
  email: string;
  name: string;
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

export function resetInMemoryStore(): void {
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

export function upsertUserFromAuth(input: AuthUserInput): StoredUser {
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
    reputationScore: 0,
    createdAt: now,
    updatedAt: now
  };

  usersById.set(created.id, created);
  usersByEmail.set(email, created);

  return created;
}

export function getUserById(userId: string): StoredUser | null {
  return usersById.get(userId) ?? null;
}

export function getUserByEmail(email: string): StoredUser | null {
  return usersByEmail.get(normalizeEmail(email)) ?? null;
}

export function updateUserRole(userId: string, role: Extract<UserRole, "LOCADOR" | "LOCATARIO">): StoredUser | null {
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

export function updateUserReputation(userId: string, rating: number): StoredUser | null {
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

interface CreateListingRecordInput {
  ownerId: string;
  title: string;
  description: string;
  dailyPrice: number;
  status: ListingStatus;
  riskLevel: RiskLevel;
}

export function createListingRecord(input: CreateListingRecordInput): StoredListing {
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

export function listListingRecords(): StoredListing[] {
  return [...listingsById.values()];
}

export function getListingById(listingId: string): StoredListing | null {
  return listingsById.get(listingId) ?? null;
}

export function updateListingStatus(listingId: string, status: ListingStatus): StoredListing | null {
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

interface CreateRiskAssessmentRecordInput {
  userId?: string;
  listingId?: string;
  score: number;
  level: RiskLevel;
  reasons: string[];
}

export function createRiskAssessmentRecord(
  input: CreateRiskAssessmentRecordInput
): StoredRiskAssessment {
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

interface CreateRentalRecordInput {
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: RentalStatus;
}

export function createRentalRecord(input: CreateRentalRecordInput): StoredRental {
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

export function getRentalById(rentalId: string): StoredRental | null {
  return rentalsById.get(rentalId) ?? null;
}

export function updateRentalStatus(rentalId: string, status: RentalStatus): StoredRental | null {
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

interface CreateReviewRecordInput {
  listingId: string;
  rentalId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
  comment?: string;
}

export function findReviewByRentalAndReviewer(
  rentalId: string,
  reviewerId: string
): StoredReview | null {
  return (
    [...reviewsById.values()].find((review) => review.rentalId === rentalId && review.reviewerId === reviewerId) ??
    null
  );
}

export function createReviewRecord(input: CreateReviewRecordInput): StoredReview {
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
  updateUserReputation(input.reviewedId, input.rating);

  return review;
}

interface CreateReportRecordInput {
  reporterId: string;
  listingId?: string;
  rentalId?: string;
  reason: string;
  details?: string;
  riskLevel: RiskLevel;
  status?: ReportStatus;
}

export function createReportRecord(input: CreateReportRecordInput): StoredReport {
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

export function listReportRecords(): StoredReport[] {
  return [...reportsById.values()];
}

export function listCriticalOpenReports(): StoredReport[] {
  return [...reportsById.values()].filter(
    (report) => report.status === "OPEN" && report.riskLevel === "CRITICAL"
  );
}

export function getReportById(reportId: string): StoredReport | null {
  return reportsById.get(reportId) ?? null;
}

export function updateReportStatus(reportId: string, status: ReportStatus): StoredReport | null {
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

interface CreateAdminAuditLogRecordInput {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export function createAdminAuditLogRecord(input: CreateAdminAuditLogRecordInput): StoredAdminAuditLog {
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

interface CreateBoostRecordInput {
  listingId: string;
  status: BoostStatus;
  amount: number;
  startsAt: Date;
  endsAt: Date;
}

export function createBoostRecord(input: CreateBoostRecordInput): StoredBoost {
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
