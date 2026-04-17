import { Prisma } from "@prisma/client";
import { env } from "../../shared/config/env";
import { prisma } from "../database/prisma-client";
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

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (value && typeof value === "object" && "toString" in value) {
    return Number((value as { toString(): string }).toString());
  }

  return Number(value);
}

function toStoredUser(user: {
  id: string;
  email: string;
  name: string;
  role: "LOCADOR" | "LOCATARIO" | "ADMIN";
  isBanned: boolean;
  bannedAt: Date | null;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}): StoredUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isBanned: user.isBanned,
    bannedAt: user.bannedAt ?? undefined,
    reputationScore: user.reputationScore,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function toStoredListing(listing: {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  dailyPrice: unknown;
  status: StoredListing["status"];
  riskLevel: StoredListing["riskLevel"];
  createdAt: Date;
  updatedAt: Date;
}): StoredListing {
  return {
    id: listing.id,
    ownerId: listing.ownerId,
    title: listing.title,
    description: listing.description,
    dailyPrice: toNumber(listing.dailyPrice),
    status: listing.status,
    riskLevel: listing.riskLevel,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt
  };
}

function toStoredRental(rental: {
  id: string;
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: unknown;
  status: StoredRental["status"];
  createdAt: Date;
  updatedAt: Date;
}): StoredRental {
  return {
    id: rental.id,
    listingId: rental.listingId,
    tenantId: rental.tenantId,
    startDate: rental.startDate,
    endDate: rental.endDate,
    totalPrice: toNumber(rental.totalPrice),
    status: rental.status,
    createdAt: rental.createdAt,
    updatedAt: rental.updatedAt
  };
}

function toStoredReport(report: {
  id: string;
  reporterId: string;
  listingId: string | null;
  rentalId: string | null;
  reason: string;
  details: string | null;
  status: StoredReport["status"];
  riskLevel: StoredReport["riskLevel"];
  createdAt: Date;
  updatedAt: Date;
}): StoredReport {
  return {
    id: report.id,
    reporterId: report.reporterId,
    listingId: report.listingId ?? undefined,
    rentalId: report.rentalId ?? undefined,
    reason: report.reason,
    details: report.details ?? undefined,
    status: report.status,
    riskLevel: report.riskLevel,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt
  };
}

function toStoredReview(review: {
  id: string;
  listingId: string;
  rentalId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
}): StoredReview {
  return {
    id: review.id,
    listingId: review.listingId,
    rentalId: review.rentalId,
    reviewerId: review.reviewerId,
    reviewedId: review.reviewedId,
    rating: review.rating,
    comment: review.comment ?? undefined,
    createdAt: review.createdAt
  };
}

async function reset(): Promise<void> {
  return;
}

async function upsertUserFromAuth(input: { id: string; email: string; name: string }): Promise<StoredUser> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const role = adminEmails.has(normalizedEmail) ? "ADMIN" : undefined;

  const user = await prisma.user.upsert({
    where: { id: input.id },
    update: {
      email: normalizedEmail,
      name: input.name,
      ...(role ? { role } : {})
    },
    create: {
      id: input.id,
      email: normalizedEmail,
      name: input.name,
      role: role ?? "LOCATARIO",
      isBanned: false
    }
  });

  return toStoredUser(user);
}

async function listUsers(): Promise<StoredUser[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" }
  });

  return users.map(toStoredUser);
}

async function getUserById(userId: string): Promise<StoredUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? toStoredUser(user) : null;
}

async function getUserByEmail(email: string): Promise<StoredUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() }
  });
  return user ? toStoredUser(user) : null;
}

async function updateUserProfile(userId: string, input: { name: string }): Promise<StoredUser | null> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name
    }
  }).catch(() => null);

  return updated ? toStoredUser(updated) : null;
}

async function updateUserRole(
  userId: string,
  role: Extract<StoredUser["role"], "LOCADOR" | "LOCATARIO">
): Promise<StoredUser | null> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role }
  }).catch(() => null);

  return updated ? toStoredUser(updated) : null;
}

async function banUser(userId: string): Promise<StoredUser | null> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: true,
      bannedAt: new Date()
    }
  }).catch(() => null);

  return updated ? toStoredUser(updated) : null;
}

async function deleteUserById(userId: string): Promise<boolean> {
  const deleted = await prisma.user.delete({
    where: { id: userId }
  }).catch(() => null);

  return Boolean(deleted);
}

async function updateUserReputation(userId: string, rating: number): Promise<StoredUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return null;
  }

  const reputationDelta = rating * 2 - 5;
  const nextScore = Math.max(0, user.reputationScore + reputationDelta);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { reputationScore: nextScore }
  });

  return toStoredUser(updated);
}

async function createListingRecord(input: {
  ownerId: string;
  title: string;
  description: string;
  dailyPrice: number;
  status: StoredListing["status"];
  riskLevel: StoredListing["riskLevel"];
}): Promise<StoredListing> {
  const listing = await prisma.listing.create({
    data: {
      ownerId: input.ownerId,
      title: input.title,
      description: input.description,
      dailyPrice: input.dailyPrice,
      status: input.status,
      riskLevel: input.riskLevel
    }
  });

  return toStoredListing(listing);
}

async function listListingRecords(): Promise<StoredListing[]> {
  const listings = await prisma.listing.findMany({
    orderBy: { createdAt: "desc" }
  });

  return listings.map(toStoredListing);
}

async function listListingsByOwner(ownerId: string): Promise<StoredListing[]> {
  const listings = await prisma.listing.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" }
  });

  return listings.map(toStoredListing);
}

async function getListingById(listingId: string): Promise<StoredListing | null> {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  return listing ? toStoredListing(listing) : null;
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
  const listing = await prisma.listing.update({
    where: { id: listingId },
    data: input
  }).catch(() => null);

  return listing ? toStoredListing(listing) : null;
}

async function updateListingStatus(
  listingId: string,
  status: StoredListing["status"]
): Promise<StoredListing | null> {
  const listing = await prisma.listing.update({
    where: { id: listingId },
    data: { status }
  }).catch(() => null);

  return listing ? toStoredListing(listing) : null;
}

async function createRiskAssessmentRecord(input: {
  userId?: string;
  listingId?: string;
  score: number;
  level: StoredRiskAssessment["level"];
  reasons: string[];
}): Promise<StoredRiskAssessment> {
  const risk = await prisma.riskAssessment.create({
    data: {
      userId: input.userId,
      listingId: input.listingId,
      score: input.score,
      level: input.level,
      reasons: input.reasons
    }
  });

  return {
    id: risk.id,
    userId: risk.userId ?? undefined,
    listingId: risk.listingId ?? undefined,
    score: risk.score,
    level: risk.level,
    reasons: Array.isArray(risk.reasons) ? (risk.reasons as string[]) : [],
    createdAt: risk.createdAt
  };
}

async function createRentalRecord(input: {
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: StoredRental["status"];
}): Promise<StoredRental> {
  const rental = await prisma.rental.create({
    data: {
      listingId: input.listingId,
      tenantId: input.tenantId,
      startDate: input.startDate,
      endDate: input.endDate,
      totalPrice: input.totalPrice,
      status: input.status
    }
  });

  return toStoredRental(rental);
}

async function getRentalById(rentalId: string): Promise<StoredRental | null> {
  const rental = await prisma.rental.findUnique({ where: { id: rentalId } });
  return rental ? toStoredRental(rental) : null;
}

async function listRentalRecords(): Promise<StoredRental[]> {
  const rentals = await prisma.rental.findMany({
    orderBy: { createdAt: "desc" }
  });

  return rentals.map(toStoredRental);
}

async function listRentalsByUser(userId: string): Promise<StoredRental[]> {
  const rentals = await prisma.rental.findMany({
    where: {
      OR: [
        { tenantId: userId },
        {
          listing: {
            ownerId: userId
          }
        }
      ]
    },
    orderBy: { createdAt: "desc" }
  });

  return rentals.map(toStoredRental);
}

async function updateRentalStatus(
  rentalId: string,
  status: StoredRental["status"]
): Promise<StoredRental | null> {
  const rental = await prisma.rental.update({
    where: { id: rentalId },
    data: { status }
  }).catch(() => null);

  return rental ? toStoredRental(rental) : null;
}

async function findReviewByRentalAndReviewer(
  rentalId: string,
  reviewerId: string
): Promise<StoredReview | null> {
  const review = await prisma.review.findUnique({
    where: {
      rentalId_reviewerId: {
        rentalId,
        reviewerId
      }
    }
  });

  if (!review) {
    return null;
  }

  return toStoredReview(review);
}

async function listReviewRecords(): Promise<StoredReview[]> {
  const reviews = await prisma.review.findMany({
    orderBy: { createdAt: "desc" }
  });

  return reviews.map(toStoredReview);
}

async function createReviewRecord(input: {
  listingId: string;
  rentalId: string;
  reviewerId: string;
  reviewedId: string;
  rating: number;
  comment?: string;
}): Promise<StoredReview> {
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        listingId: input.listingId,
        rentalId: input.rentalId,
        reviewerId: input.reviewerId,
        reviewedId: input.reviewedId,
        rating: input.rating,
        comment: input.comment
      }
    });

    const reviewedUser = await tx.user.findUnique({
      where: { id: input.reviewedId }
    });

    if (reviewedUser) {
      const reputationDelta = input.rating * 2 - 5;
      const nextScore = Math.max(0, reviewedUser.reputationScore + reputationDelta);
      await tx.user.update({
        where: { id: input.reviewedId },
        data: { reputationScore: nextScore }
      });
    }

    return created;
  });

  return toStoredReview(review);
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
  const report = await prisma.report.create({
    data: {
      reporterId: input.reporterId,
      listingId: input.listingId,
      rentalId: input.rentalId,
      reason: input.reason,
      details: input.details,
      riskLevel: input.riskLevel,
      status: input.status ?? "OPEN"
    }
  });

  return toStoredReport(report);
}

async function listReportRecords(): Promise<StoredReport[]> {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" }
  });

  return reports.map(toStoredReport);
}

async function listCriticalOpenReports(): Promise<StoredReport[]> {
  const reports = await prisma.report.findMany({
    where: {
      status: "OPEN",
      riskLevel: "CRITICAL"
    },
    orderBy: { createdAt: "desc" }
  });

  return reports.map(toStoredReport);
}

async function getReportById(reportId: string): Promise<StoredReport | null> {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  return report ? toStoredReport(report) : null;
}

async function updateReportStatus(
  reportId: string,
  status: StoredReport["status"]
): Promise<StoredReport | null> {
  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status }
  }).catch(() => null);

  return report ? toStoredReport(report) : null;
}

async function createAdminAuditLogRecord(input: {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<StoredAdminAuditLog> {
  const audit = await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined
    }
  });

  return {
    id: audit.id,
    adminId: audit.adminId ?? input.adminId,
    action: audit.action,
    entityType: audit.entityType,
    entityId: audit.entityId,
    metadata: (audit.metadata as Record<string, unknown>) ?? undefined,
    createdAt: audit.createdAt
  };
}

async function createBoostRecord(input: {
  listingId: string;
  status: StoredBoost["status"];
  amount: number;
  startsAt: Date;
  endsAt: Date;
}): Promise<StoredBoost> {
  const boost = await prisma.boost.create({
    data: {
      listingId: input.listingId,
      status: input.status,
      amount: input.amount,
      startsAt: input.startsAt,
      endsAt: input.endsAt
    }
  });

  return {
    id: boost.id,
    listingId: boost.listingId,
    status: boost.status,
    amount: toNumber(boost.amount),
    startsAt: boost.startsAt ?? input.startsAt,
    endsAt: boost.endsAt ?? input.endsAt,
    createdAt: boost.createdAt,
    updatedAt: boost.updatedAt
  };
}

async function listBoostRecords(): Promise<StoredBoost[]> {
  const boosts = await prisma.boost.findMany({
    orderBy: { createdAt: "desc" }
  });

  return boosts.map((boost) => ({
    id: boost.id,
    listingId: boost.listingId,
    status: boost.status,
    amount: toNumber(boost.amount),
    startsAt: boost.startsAt ?? boost.createdAt,
    endsAt: boost.endsAt ?? boost.updatedAt,
    createdAt: boost.createdAt,
    updatedAt: boost.updatedAt
  }));
}

export const prismaStore: PersistenceStore = {
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
  listReviewRecords,
  createReviewRecord,
  createReportRecord,
  listReportRecords,
  listCriticalOpenReports,
  getReportById,
  updateReportStatus,
  createAdminAuditLogRecord,
  createBoostRecord,
  listBoostRecords
};
