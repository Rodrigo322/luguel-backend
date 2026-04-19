import { randomUUID } from "node:crypto";
import { env } from "../../shared/config/env";
import type { UserRole } from "../../shared/types/role";
import type {
  PersistenceStore,
  StoredAdminAuditLog,
  StoredBoost,
  StoredPremiumSubscription,
  StoredListingAvailabilitySlot,
  StoredListing,
  StoredRentalChatMessage,
  StoredRentalContract,
  StoredRentalPayment,
  StoredRentalReceipt,
  StoredRental,
  StoredReport,
  StoredReview,
  StoredRiskAssessment,
  StoredUserIdentityVerification,
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
const rentalPaymentsById = new Map<string, StoredRentalPayment>();
const rentalPaymentsByRentalId = new Map<string, StoredRentalPayment>();
const rentalContractsById = new Map<string, StoredRentalContract>();
const rentalContractsByRentalId = new Map<string, StoredRentalContract>();
const rentalReceiptsById = new Map<string, StoredRentalReceipt>();
const rentalReceiptsByRentalId = new Map<string, StoredRentalReceipt>();
const rentalChatMessagesById = new Map<string, StoredRentalChatMessage>();
const reviewsById = new Map<string, StoredReview>();
const reportsById = new Map<string, StoredReport>();
const boostsById = new Map<string, StoredBoost>();
const listingAvailabilityById = new Map<string, StoredListingAvailabilitySlot>();
const riskAssessmentsById = new Map<string, StoredRiskAssessment>();
const adminAuditLogsById = new Map<string, StoredAdminAuditLog>();
const identityVerificationById = new Map<string, StoredUserIdentityVerification>();
const identityVerificationByUserId = new Map<string, StoredUserIdentityVerification>();
const premiumSubscriptionsById = new Map<string, StoredPremiumSubscription>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function reset(): Promise<void> {
  usersById.clear();
  usersByEmail.clear();
  listingsById.clear();
  rentalsById.clear();
  rentalPaymentsById.clear();
  rentalPaymentsByRentalId.clear();
  rentalContractsById.clear();
  rentalContractsByRentalId.clear();
  rentalReceiptsById.clear();
  rentalReceiptsByRentalId.clear();
  rentalChatMessagesById.clear();
  reviewsById.clear();
  reportsById.clear();
  boostsById.clear();
  listingAvailabilityById.clear();
  riskAssessmentsById.clear();
  adminAuditLogsById.clear();
  identityVerificationById.clear();
  identityVerificationByUserId.clear();
  premiumSubscriptionsById.clear();
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
    identityVerificationStatus: "PENDING",
    identityVerifiedAt: undefined,
    plan: "FREE",
    planExpiresAt: undefined,
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

async function submitUserIdentityVerification(input: {
  userId: string;
  documentType: string;
  documentNumberHash: string;
  fullName: string;
  birthDate: Date;
}): Promise<StoredUserIdentityVerification> {
  const now = new Date();
  const existing = identityVerificationByUserId.get(input.userId);

  const verification: StoredUserIdentityVerification = existing
    ? {
        ...existing,
        documentType: input.documentType,
        documentNumberHash: input.documentNumberHash,
        fullName: input.fullName,
        birthDate: input.birthDate,
        status: "PENDING",
        notes: undefined,
        submittedAt: now,
        reviewedAt: undefined,
        updatedAt: now
      }
    : {
        id: randomUUID(),
        userId: input.userId,
        documentType: input.documentType,
        documentNumberHash: input.documentNumberHash,
        fullName: input.fullName,
        birthDate: input.birthDate,
        status: "PENDING",
        notes: undefined,
        submittedAt: now,
        reviewedAt: undefined,
        createdAt: now,
        updatedAt: now
      };

  identityVerificationById.set(verification.id, verification);
  identityVerificationByUserId.set(verification.userId, verification);

  const user = usersById.get(input.userId);
  if (user) {
    const updatedUser: StoredUser = {
      ...user,
      identityVerificationStatus: "PENDING",
      identityVerifiedAt: undefined,
      updatedAt: now
    };
    usersById.set(updatedUser.id, updatedUser);
    usersByEmail.set(updatedUser.email, updatedUser);
  }

  return verification;
}

async function getUserIdentityVerification(userId: string): Promise<StoredUserIdentityVerification | null> {
  return identityVerificationByUserId.get(userId) ?? null;
}

async function reviewUserIdentityVerification(input: {
  userId: string;
  status: StoredUser["identityVerificationStatus"];
  notes?: string;
}): Promise<StoredUserIdentityVerification | null> {
  const existing = identityVerificationByUserId.get(input.userId);

  if (!existing) {
    return null;
  }

  const now = new Date();
  const reviewed: StoredUserIdentityVerification = {
    ...existing,
    status: input.status,
    notes: input.notes,
    reviewedAt: now,
    updatedAt: now
  };

  identityVerificationById.set(reviewed.id, reviewed);
  identityVerificationByUserId.set(reviewed.userId, reviewed);

  const user = usersById.get(input.userId);
  if (user) {
    const updatedUser: StoredUser = {
      ...user,
      identityVerificationStatus: input.status,
      identityVerifiedAt: input.status === "VERIFIED" ? now : undefined,
      updatedAt: now
    };
    usersById.set(updatedUser.id, updatedUser);
    usersByEmail.set(updatedUser.email, updatedUser);
  }

  return reviewed;
}

async function createPremiumSubscription(input: {
  userId: string;
  amount: number;
  months: number;
  status?: StoredPremiumSubscription["status"];
}): Promise<StoredPremiumSubscription> {
  const now = new Date();
  const startsAt = now;
  const endsAt = new Date(now.getTime());
  endsAt.setMonth(endsAt.getMonth() + input.months);

  const subscription: StoredPremiumSubscription = {
    id: randomUUID(),
    userId: input.userId,
    status: input.status ?? "ACTIVE",
    amount: input.amount,
    months: input.months,
    startsAt,
    endsAt,
    createdAt: now,
    updatedAt: now
  };

  premiumSubscriptionsById.set(subscription.id, subscription);

  const user = usersById.get(input.userId);
  if (user) {
    const updatedUser: StoredUser = {
      ...user,
      plan: subscription.status === "ACTIVE" ? "PREMIUM" : "FREE",
      planExpiresAt: subscription.status === "ACTIVE" ? subscription.endsAt : undefined,
      updatedAt: now
    };
    usersById.set(updatedUser.id, updatedUser);
    usersByEmail.set(updatedUser.email, updatedUser);
  }

  return subscription;
}

async function getLatestPremiumSubscription(userId: string): Promise<StoredPremiumSubscription | null> {
  const all = [...premiumSubscriptionsById.values()]
    .filter((subscription) => subscription.userId === userId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return all[0] ?? null;
}

async function createListingRecord(input: {
  ownerId: string;
  title: string;
  description: string;
  category?: string;
  city?: string;
  region?: string;
  dailyPrice: number;
  deliveryMode?: StoredListing["deliveryMode"];
  bookingMode?: StoredListing["bookingMode"];
  status: StoredListing["status"];
  riskLevel: StoredListing["riskLevel"];
}): Promise<StoredListing> {
  const now = new Date();
  const listing: StoredListing = {
    id: randomUUID(),
    ownerId: input.ownerId,
    title: input.title,
    description: input.description,
    category: input.category,
    city: input.city,
    region: input.region,
    dailyPrice: input.dailyPrice,
    deliveryMode: input.deliveryMode ?? "BOTH",
    bookingMode: input.bookingMode ?? "BOTH",
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
    category: string;
    city: string;
    region: string;
    dailyPrice: number;
    deliveryMode: StoredListing["deliveryMode"];
    bookingMode: StoredListing["bookingMode"];
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

async function replaceListingAvailabilitySlots(input: {
  listingId: string;
  slots: Array<{
    date: Date;
    status: StoredListingAvailabilitySlot["status"];
    pickupTime?: string;
    returnTime?: string;
  }>;
}): Promise<StoredListingAvailabilitySlot[]> {
  const listingExists = listingsById.has(input.listingId);

  if (!listingExists) {
    return [];
  }

  for (const slot of [...listingAvailabilityById.values()]) {
    if (slot.listingId === input.listingId) {
      listingAvailabilityById.delete(slot.id);
    }
  }

  const now = new Date();
  const createdSlots: StoredListingAvailabilitySlot[] = input.slots.map((slot) => {
    const created: StoredListingAvailabilitySlot = {
      id: randomUUID(),
      listingId: input.listingId,
      date: slot.date,
      status: slot.status,
      pickupTime: slot.pickupTime,
      returnTime: slot.returnTime,
      createdAt: now,
      updatedAt: now
    };

    listingAvailabilityById.set(created.id, created);
    return created;
  });

  return createdSlots.sort((left, right) => left.date.getTime() - right.date.getTime());
}

async function listListingAvailabilityByListing(
  listingId: string
): Promise<StoredListingAvailabilitySlot[]> {
  return [...listingAvailabilityById.values()]
    .filter((slot) => slot.listingId === listingId)
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

async function listListingAvailabilityRecords(): Promise<StoredListingAvailabilitySlot[]> {
  return [...listingAvailabilityById.values()].sort((left, right) => left.date.getTime() - right.date.getTime());
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
  fulfillmentMethod?: StoredRental["fulfillmentMethod"];
  deliveryAddress?: string;
  platformFee?: number;
  depositAmount?: number;
  signalAmount?: number;
  remainderAmount?: number;
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
    fulfillmentMethod: input.fulfillmentMethod ?? "PICKUP_LOCAL",
    deliveryAddress: input.deliveryAddress,
    platformFee: input.platformFee ?? 0,
    depositAmount: input.depositAmount ?? 0,
    signalAmount: input.signalAmount ?? 0,
    remainderAmount: input.remainderAmount ?? 0,
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

async function createRentalPaymentRecord(input: {
  rentalId: string;
  mode: StoredRentalPayment["mode"];
  status?: StoredRentalPayment["status"];
  totalAmount: number;
  platformFeeAmount: number;
  depositAmount: number;
  signalAmount: number;
  remainderAmount: number;
  paidAmount?: number;
  inAppPaymentReference?: string;
  proofUrl?: string;
}): Promise<StoredRentalPayment> {
  const now = new Date();
  const existing = rentalPaymentsByRentalId.get(input.rentalId);

  const payment: StoredRentalPayment = existing
    ? {
        ...existing,
        mode: input.mode,
        status: input.status ?? existing.status,
        totalAmount: input.totalAmount,
        platformFeeAmount: input.platformFeeAmount,
        depositAmount: input.depositAmount,
        signalAmount: input.signalAmount,
        remainderAmount: input.remainderAmount,
        paidAmount: input.paidAmount ?? existing.paidAmount,
        inAppPaymentReference: input.inAppPaymentReference ?? existing.inAppPaymentReference,
        proofUrl: input.proofUrl ?? existing.proofUrl,
        updatedAt: now
      }
    : {
        id: randomUUID(),
        rentalId: input.rentalId,
        mode: input.mode,
        status: input.status ?? "PENDING",
        totalAmount: input.totalAmount,
        platformFeeAmount: input.platformFeeAmount,
        depositAmount: input.depositAmount,
        signalAmount: input.signalAmount,
        remainderAmount: input.remainderAmount,
        paidAmount: input.paidAmount ?? 0,
        inAppPaymentReference: input.inAppPaymentReference,
        proofUrl: input.proofUrl,
        createdAt: now,
        updatedAt: now
      };

  rentalPaymentsById.set(payment.id, payment);
  rentalPaymentsByRentalId.set(payment.rentalId, payment);

  return payment;
}

async function getRentalPaymentByRentalId(rentalId: string): Promise<StoredRentalPayment | null> {
  return rentalPaymentsByRentalId.get(rentalId) ?? null;
}

async function updateRentalPaymentRecord(
  rentalId: string,
  input: Partial<{
    status: StoredRentalPayment["status"];
    paidAmount: number;
    inAppPaymentReference: string;
    proofUrl: string;
  }>
): Promise<StoredRentalPayment | null> {
  const existing = rentalPaymentsByRentalId.get(rentalId);

  if (!existing) {
    return null;
  }

  const updated: StoredRentalPayment = {
    ...existing,
    ...input,
    updatedAt: new Date()
  };

  rentalPaymentsById.set(updated.id, updated);
  rentalPaymentsByRentalId.set(updated.rentalId, updated);

  return updated;
}

async function createRentalContractRecord(input: {
  rentalId: string;
  termsVersion: string;
  contractText: string;
  checksum: string;
}): Promise<StoredRentalContract> {
  const now = new Date();
  const existing = rentalContractsByRentalId.get(input.rentalId);

  const contract: StoredRentalContract = existing
    ? {
        ...existing,
        termsVersion: input.termsVersion,
        contractText: input.contractText,
        checksum: input.checksum,
        acceptedByOwnerAt: undefined,
        acceptedByTenantAt: undefined,
        updatedAt: now
      }
    : {
        id: randomUUID(),
        rentalId: input.rentalId,
        termsVersion: input.termsVersion,
        contractText: input.contractText,
        checksum: input.checksum,
        acceptedByOwnerAt: undefined,
        acceptedByTenantAt: undefined,
        createdAt: now,
        updatedAt: now
      };

  rentalContractsById.set(contract.id, contract);
  rentalContractsByRentalId.set(contract.rentalId, contract);

  return contract;
}

async function getRentalContractByRentalId(rentalId: string): Promise<StoredRentalContract | null> {
  return rentalContractsByRentalId.get(rentalId) ?? null;
}

async function acceptRentalContract(input: {
  rentalId: string;
  acceptedBy: "TENANT" | "OWNER";
}): Promise<StoredRentalContract | null> {
  const existing = rentalContractsByRentalId.get(input.rentalId);

  if (!existing) {
    return null;
  }

  const now = new Date();
  const updated: StoredRentalContract = {
    ...existing,
    acceptedByOwnerAt: input.acceptedBy === "OWNER" ? now : existing.acceptedByOwnerAt,
    acceptedByTenantAt: input.acceptedBy === "TENANT" ? now : existing.acceptedByTenantAt,
    updatedAt: now
  };

  rentalContractsById.set(updated.id, updated);
  rentalContractsByRentalId.set(updated.rentalId, updated);

  return updated;
}

async function createRentalReceiptRecord(input: {
  rentalId: string;
  receiptNumber: string;
  issuedAt: Date;
  payload: Record<string, unknown>;
}): Promise<StoredRentalReceipt> {
  const existing = rentalReceiptsByRentalId.get(input.rentalId);

  if (existing) {
    return existing;
  }

  const receipt: StoredRentalReceipt = {
    id: randomUUID(),
    rentalId: input.rentalId,
    receiptNumber: input.receiptNumber,
    issuedAt: input.issuedAt,
    payload: input.payload,
    createdAt: new Date()
  };

  rentalReceiptsById.set(receipt.id, receipt);
  rentalReceiptsByRentalId.set(receipt.rentalId, receipt);

  return receipt;
}

async function getRentalReceiptByRentalId(rentalId: string): Promise<StoredRentalReceipt | null> {
  return rentalReceiptsByRentalId.get(rentalId) ?? null;
}

async function createRentalChatMessage(input: {
  rentalId: string;
  senderId: string;
  message: string;
}): Promise<StoredRentalChatMessage> {
  const chat: StoredRentalChatMessage = {
    id: randomUUID(),
    rentalId: input.rentalId,
    senderId: input.senderId,
    message: input.message,
    createdAt: new Date()
  };

  rentalChatMessagesById.set(chat.id, chat);

  return chat;
}

async function listRentalChatMessages(rentalId: string): Promise<StoredRentalChatMessage[]> {
  return [...rentalChatMessagesById.values()]
    .filter((chat) => chat.rentalId === rentalId)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
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

async function listReviewRecords(): Promise<StoredReview[]> {
  return [...reviewsById.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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

async function listBoostRecords(): Promise<StoredBoost[]> {
  return [...boostsById.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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
  submitUserIdentityVerification,
  getUserIdentityVerification,
  reviewUserIdentityVerification,
  createPremiumSubscription,
  getLatestPremiumSubscription,
  createListingRecord,
  listListingRecords,
  listListingsByOwner,
  getListingById,
  updateListingRecord,
  updateListingStatus,
  replaceListingAvailabilitySlots,
  listListingAvailabilityByListing,
  listListingAvailabilityRecords,
  createRiskAssessmentRecord,
  createRentalRecord,
  getRentalById,
  listRentalRecords,
  listRentalsByUser,
  updateRentalStatus,
  createRentalPaymentRecord,
  getRentalPaymentByRentalId,
  updateRentalPaymentRecord,
  createRentalContractRecord,
  getRentalContractByRentalId,
  acceptRentalContract,
  createRentalReceiptRecord,
  getRentalReceiptByRentalId,
  createRentalChatMessage,
  listRentalChatMessages,
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
