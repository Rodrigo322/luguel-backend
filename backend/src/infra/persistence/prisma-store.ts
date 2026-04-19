import { Prisma } from "@prisma/client";
import { env } from "../../shared/config/env";
import { prisma } from "../database/prisma-client";
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
  identityVerificationStatus: StoredUser["identityVerificationStatus"];
  identityVerifiedAt: Date | null;
  plan: StoredUser["plan"];
  planExpiresAt: Date | null;
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
    identityVerificationStatus: user.identityVerificationStatus,
    identityVerifiedAt: user.identityVerifiedAt ?? undefined,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt ?? undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function toStoredListing(listing: {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string | null;
  city: string | null;
  region: string | null;
  dailyPrice: unknown;
  deliveryMode: StoredListing["deliveryMode"];
  bookingMode: StoredListing["bookingMode"];
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
    category: listing.category ?? undefined,
    city: listing.city ?? undefined,
    region: listing.region ?? undefined,
    dailyPrice: toNumber(listing.dailyPrice),
    deliveryMode: listing.deliveryMode,
    bookingMode: listing.bookingMode,
    status: listing.status,
    riskLevel: listing.riskLevel,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt
  };
}

function toStoredAvailabilitySlot(slot: {
  id: string;
  listingId: string;
  date: Date;
  status: StoredListingAvailabilitySlot["status"];
  pickupTime: string | null;
  returnTime: string | null;
  createdAt: Date;
  updatedAt: Date;
}): StoredListingAvailabilitySlot {
  return {
    id: slot.id,
    listingId: slot.listingId,
    date: slot.date,
    status: slot.status,
    pickupTime: slot.pickupTime ?? undefined,
    returnTime: slot.returnTime ?? undefined,
    createdAt: slot.createdAt,
    updatedAt: slot.updatedAt
  };
}

function toStoredRental(rental: {
  id: string;
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: unknown;
  fulfillmentMethod: StoredRental["fulfillmentMethod"];
  deliveryAddress: string | null;
  platformFee: unknown;
  depositAmount: unknown;
  signalAmount: unknown;
  remainderAmount: unknown;
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
    fulfillmentMethod: rental.fulfillmentMethod,
    deliveryAddress: rental.deliveryAddress ?? undefined,
    platformFee: toNumber(rental.platformFee),
    depositAmount: toNumber(rental.depositAmount),
    signalAmount: toNumber(rental.signalAmount),
    remainderAmount: toNumber(rental.remainderAmount),
    status: rental.status,
    createdAt: rental.createdAt,
    updatedAt: rental.updatedAt
  };
}

function toStoredRentalPayment(payment: {
  id: string;
  rentalId: string;
  mode: StoredRentalPayment["mode"];
  status: StoredRentalPayment["status"];
  totalAmount: unknown;
  platformFeeAmount: unknown;
  depositAmount: unknown;
  signalAmount: unknown;
  remainderAmount: unknown;
  paidAmount: unknown;
  inAppPaymentReference: string | null;
  proofUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): StoredRentalPayment {
  return {
    id: payment.id,
    rentalId: payment.rentalId,
    mode: payment.mode,
    status: payment.status,
    totalAmount: toNumber(payment.totalAmount),
    platformFeeAmount: toNumber(payment.platformFeeAmount),
    depositAmount: toNumber(payment.depositAmount),
    signalAmount: toNumber(payment.signalAmount),
    remainderAmount: toNumber(payment.remainderAmount),
    paidAmount: toNumber(payment.paidAmount),
    inAppPaymentReference: payment.inAppPaymentReference ?? undefined,
    proofUrl: payment.proofUrl ?? undefined,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}

function toStoredRentalContract(contract: {
  id: string;
  rentalId: string;
  termsVersion: string;
  contractText: string;
  checksum: string;
  acceptedByTenantAt: Date | null;
  acceptedByOwnerAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): StoredRentalContract {
  return {
    id: contract.id,
    rentalId: contract.rentalId,
    termsVersion: contract.termsVersion,
    contractText: contract.contractText,
    checksum: contract.checksum,
    acceptedByTenantAt: contract.acceptedByTenantAt ?? undefined,
    acceptedByOwnerAt: contract.acceptedByOwnerAt ?? undefined,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt
  };
}

function toStoredRentalReceipt(receipt: {
  id: string;
  rentalId: string;
  receiptNumber: string;
  issuedAt: Date;
  payload: Prisma.JsonValue;
  createdAt: Date;
}): StoredRentalReceipt {
  return {
    id: receipt.id,
    rentalId: receipt.rentalId,
    receiptNumber: receipt.receiptNumber,
    issuedAt: receipt.issuedAt,
    payload: (receipt.payload as Record<string, unknown>) ?? {},
    createdAt: receipt.createdAt
  };
}

function toStoredRentalChatMessage(message: {
  id: string;
  rentalId: string;
  senderId: string;
  message: string;
  createdAt: Date;
}): StoredRentalChatMessage {
  return {
    id: message.id,
    rentalId: message.rentalId,
    senderId: message.senderId,
    message: message.message,
    createdAt: message.createdAt
  };
}

function toStoredUserIdentityVerification(verification: {
  id: string;
  userId: string;
  documentType: string;
  documentNumberHash: string;
  fullName: string;
  birthDate: Date;
  status: StoredUserIdentityVerification["status"];
  notes: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): StoredUserIdentityVerification {
  return {
    id: verification.id,
    userId: verification.userId,
    documentType: verification.documentType,
    documentNumberHash: verification.documentNumberHash,
    fullName: verification.fullName,
    birthDate: verification.birthDate,
    status: verification.status,
    notes: verification.notes ?? undefined,
    submittedAt: verification.submittedAt,
    reviewedAt: verification.reviewedAt ?? undefined,
    createdAt: verification.createdAt,
    updatedAt: verification.updatedAt
  };
}

function toStoredPremiumSubscription(subscription: {
  id: string;
  userId: string;
  status: StoredPremiumSubscription["status"];
  amount: unknown;
  months: number;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): StoredPremiumSubscription {
  return {
    id: subscription.id,
    userId: subscription.userId,
    status: subscription.status,
    amount: toNumber(subscription.amount),
    months: subscription.months,
    startsAt: subscription.startsAt,
    endsAt: subscription.endsAt,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt
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

async function submitUserIdentityVerification(input: {
  userId: string;
  documentType: string;
  documentNumberHash: string;
  fullName: string;
  birthDate: Date;
}): Promise<StoredUserIdentityVerification> {
  const verification = await prisma.$transaction(async (tx) => {
    const upserted = await tx.userIdentityVerification.upsert({
      where: { userId: input.userId },
      update: {
        documentType: input.documentType,
        documentNumberHash: input.documentNumberHash,
        fullName: input.fullName,
        birthDate: input.birthDate,
        status: "PENDING",
        notes: null,
        submittedAt: new Date(),
        reviewedAt: null
      },
      create: {
        userId: input.userId,
        documentType: input.documentType,
        documentNumberHash: input.documentNumberHash,
        fullName: input.fullName,
        birthDate: input.birthDate,
        status: "PENDING"
      }
    });

    await tx.user.update({
      where: { id: input.userId },
      data: {
        identityVerificationStatus: "PENDING",
        identityVerifiedAt: null
      }
    });

    return upserted;
  });

  return toStoredUserIdentityVerification(verification);
}

async function getUserIdentityVerification(userId: string): Promise<StoredUserIdentityVerification | null> {
  const verification = await prisma.userIdentityVerification.findUnique({
    where: { userId }
  });

  return verification ? toStoredUserIdentityVerification(verification) : null;
}

async function reviewUserIdentityVerification(input: {
  userId: string;
  status: StoredUser["identityVerificationStatus"];
  notes?: string;
}): Promise<StoredUserIdentityVerification | null> {
  const reviewed = await prisma.$transaction(async (tx) => {
    const updatedVerification = await tx.userIdentityVerification.update({
      where: { userId: input.userId },
      data: {
        status: input.status,
        notes: input.notes,
        reviewedAt: new Date()
      }
    }).catch(() => null);

    if (!updatedVerification) {
      return null;
    }

    await tx.user.update({
      where: { id: input.userId },
      data: {
        identityVerificationStatus: input.status,
        identityVerifiedAt: input.status === "VERIFIED" ? new Date() : null
      }
    });

    return updatedVerification;
  });

  return reviewed ? toStoredUserIdentityVerification(reviewed) : null;
}

async function createPremiumSubscription(input: {
  userId: string;
  amount: number;
  months: number;
  status?: StoredPremiumSubscription["status"];
}): Promise<StoredPremiumSubscription> {
  const now = new Date();
  const endsAt = new Date(now.getTime());
  endsAt.setMonth(endsAt.getMonth() + input.months);
  const status = input.status ?? "ACTIVE";

  const subscription = await prisma.$transaction(async (tx) => {
    const created = await tx.premiumSubscription.create({
      data: {
        userId: input.userId,
        status,
        amount: input.amount,
        months: input.months,
        startsAt: now,
        endsAt
      }
    });

    await tx.user.update({
      where: { id: input.userId },
      data: {
        plan: status === "ACTIVE" ? "PREMIUM" : "FREE",
        planExpiresAt: status === "ACTIVE" ? endsAt : null
      }
    });

    return created;
  });

  return toStoredPremiumSubscription(subscription);
}

async function getLatestPremiumSubscription(userId: string): Promise<StoredPremiumSubscription | null> {
  const subscription = await prisma.premiumSubscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });

  return subscription ? toStoredPremiumSubscription(subscription) : null;
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
  const listing = await prisma.listing.create({
    data: {
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
  const listing = await prisma.listing.update({
    where: { id: listingId },
    data: input
  }).catch(() => null);

  return listing ? toStoredListing(listing) : null;
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
  const listing = await prisma.listing.findUnique({
    where: { id: input.listingId },
    select: { id: true }
  });

  if (!listing) {
    return [];
  }

  const slots = await prisma.$transaction(async (tx) => {
    await tx.listingAvailabilitySlot.deleteMany({
      where: {
        listingId: input.listingId
      }
    });

    if (input.slots.length === 0) {
      return [];
    }

    const created = await Promise.all(
      input.slots.map((slot) =>
        tx.listingAvailabilitySlot.create({
          data: {
            listingId: input.listingId,
            date: slot.date,
            status: slot.status,
            pickupTime: slot.pickupTime,
            returnTime: slot.returnTime
          }
        })
      )
    );

    return created;
  });

  return slots.map(toStoredAvailabilitySlot).sort((left, right) => left.date.getTime() - right.date.getTime());
}

async function listListingAvailabilityByListing(
  listingId: string
): Promise<StoredListingAvailabilitySlot[]> {
  const slots = await prisma.listingAvailabilitySlot.findMany({
    where: { listingId },
    orderBy: { date: "asc" }
  });

  return slots.map(toStoredAvailabilitySlot);
}

async function listListingAvailabilityRecords(): Promise<StoredListingAvailabilitySlot[]> {
  const slots = await prisma.listingAvailabilitySlot.findMany({
    orderBy: [{ listingId: "asc" }, { date: "asc" }]
  });

  return slots.map(toStoredAvailabilitySlot);
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
  fulfillmentMethod?: StoredRental["fulfillmentMethod"];
  deliveryAddress?: string;
  platformFee?: number;
  depositAmount?: number;
  signalAmount?: number;
  remainderAmount?: number;
  status: StoredRental["status"];
}): Promise<StoredRental> {
  const rental = await prisma.rental.create({
    data: {
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
  const payment = await prisma.rentalPayment.upsert({
    where: { rentalId: input.rentalId },
    update: {
      mode: input.mode,
      status: input.status ?? "PENDING",
      totalAmount: input.totalAmount,
      platformFeeAmount: input.platformFeeAmount,
      depositAmount: input.depositAmount,
      signalAmount: input.signalAmount,
      remainderAmount: input.remainderAmount,
      paidAmount: input.paidAmount ?? 0,
      inAppPaymentReference: input.inAppPaymentReference,
      proofUrl: input.proofUrl
    },
    create: {
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
      proofUrl: input.proofUrl
    }
  });

  return toStoredRentalPayment(payment);
}

async function getRentalPaymentByRentalId(rentalId: string): Promise<StoredRentalPayment | null> {
  const payment = await prisma.rentalPayment.findUnique({
    where: { rentalId }
  });

  return payment ? toStoredRentalPayment(payment) : null;
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
  const payment = await prisma.rentalPayment.update({
    where: { rentalId },
    data: {
      status: input.status,
      paidAmount: input.paidAmount,
      inAppPaymentReference: input.inAppPaymentReference,
      proofUrl: input.proofUrl
    }
  }).catch(() => null);

  return payment ? toStoredRentalPayment(payment) : null;
}

async function createRentalContractRecord(input: {
  rentalId: string;
  termsVersion: string;
  contractText: string;
  checksum: string;
}): Promise<StoredRentalContract> {
  const contract = await prisma.rentalContract.upsert({
    where: { rentalId: input.rentalId },
    update: {
      termsVersion: input.termsVersion,
      contractText: input.contractText,
      checksum: input.checksum,
      acceptedByOwnerAt: null,
      acceptedByTenantAt: null
    },
    create: {
      rentalId: input.rentalId,
      termsVersion: input.termsVersion,
      contractText: input.contractText,
      checksum: input.checksum
    }
  });

  return toStoredRentalContract(contract);
}

async function getRentalContractByRentalId(rentalId: string): Promise<StoredRentalContract | null> {
  const contract = await prisma.rentalContract.findUnique({
    where: { rentalId }
  });

  return contract ? toStoredRentalContract(contract) : null;
}

async function acceptRentalContract(input: {
  rentalId: string;
  acceptedBy: "TENANT" | "OWNER";
}): Promise<StoredRentalContract | null> {
  const contract = await prisma.rentalContract.update({
    where: { rentalId: input.rentalId },
    data:
      input.acceptedBy === "TENANT"
        ? { acceptedByTenantAt: new Date() }
        : { acceptedByOwnerAt: new Date() }
  }).catch(() => null);

  return contract ? toStoredRentalContract(contract) : null;
}

async function createRentalReceiptRecord(input: {
  rentalId: string;
  receiptNumber: string;
  issuedAt: Date;
  payload: Record<string, unknown>;
}): Promise<StoredRentalReceipt> {
  const receipt = await prisma.rentalReceipt.upsert({
    where: { rentalId: input.rentalId },
    update: {
      receiptNumber: input.receiptNumber,
      issuedAt: input.issuedAt,
      payload: input.payload as Prisma.InputJsonValue
    },
    create: {
      rentalId: input.rentalId,
      receiptNumber: input.receiptNumber,
      issuedAt: input.issuedAt,
      payload: input.payload as Prisma.InputJsonValue
    }
  });

  return toStoredRentalReceipt(receipt);
}

async function getRentalReceiptByRentalId(rentalId: string): Promise<StoredRentalReceipt | null> {
  const receipt = await prisma.rentalReceipt.findUnique({
    where: { rentalId }
  });

  return receipt ? toStoredRentalReceipt(receipt) : null;
}

async function createRentalChatMessage(input: {
  rentalId: string;
  senderId: string;
  message: string;
}): Promise<StoredRentalChatMessage> {
  const chat = await prisma.rentalChatMessage.create({
    data: {
      rentalId: input.rentalId,
      senderId: input.senderId,
      message: input.message
    }
  });

  return toStoredRentalChatMessage(chat);
}

async function listRentalChatMessages(rentalId: string): Promise<StoredRentalChatMessage[]> {
  const chatMessages = await prisma.rentalChatMessage.findMany({
    where: { rentalId },
    orderBy: { createdAt: "asc" }
  });

  return chatMessages.map(toStoredRentalChatMessage);
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
