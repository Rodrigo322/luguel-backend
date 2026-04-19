import type { ListingStatus } from "../../domain/listings/entities/listing";
import type {
  ListingBookingMode,
  ListingDeliveryMode
} from "../../domain/listings/entities/listing";
import type {
  ListingAvailabilityStatus
} from "../../domain/listings/entities/listing-availability";
import type { RentalStatus } from "../../domain/rentals/entities/rental";
import type {
  RentalFulfillmentMethod,
  RentalPaymentMode,
  RentalPaymentStatus
} from "../../domain/rentals/entities/rental-payment";
import type { ReportStatus } from "../../domain/reports/entities/report";
import type { BoostStatus } from "../../domain/boost/entities/boost";
import type { RiskLevel } from "../../domain/shared/risk/risk-level";
import type { UserRole } from "../../shared/types/role";
import type {
  IdentityVerificationStatus,
  PremiumSubscriptionStatus,
  UserPlan
} from "../../domain/users/entities/user-identity-verification";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isBanned: boolean;
  bannedAt?: Date;
  reputationScore: number;
  identityVerificationStatus: IdentityVerificationStatus;
  identityVerifiedAt?: Date;
  plan: UserPlan;
  planExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredListing {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category?: string;
  city?: string;
  region?: string;
  dailyPrice: number;
  deliveryMode: ListingDeliveryMode;
  bookingMode: ListingBookingMode;
  status: ListingStatus;
  riskLevel: RiskLevel;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredListingAvailabilitySlot {
  id: string;
  listingId: string;
  date: Date;
  status: ListingAvailabilityStatus;
  pickupTime?: string;
  returnTime?: string;
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
  fulfillmentMethod: RentalFulfillmentMethod;
  deliveryAddress?: string;
  platformFee: number;
  depositAmount: number;
  signalAmount: number;
  remainderAmount: number;
  status: RentalStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredRentalPayment {
  id: string;
  rentalId: string;
  mode: RentalPaymentMode;
  status: RentalPaymentStatus;
  totalAmount: number;
  platformFeeAmount: number;
  depositAmount: number;
  signalAmount: number;
  remainderAmount: number;
  paidAmount: number;
  inAppPaymentReference?: string;
  proofUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredRentalContract {
  id: string;
  rentalId: string;
  termsVersion: string;
  contractText: string;
  checksum: string;
  acceptedByTenantAt?: Date;
  acceptedByOwnerAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredRentalReceipt {
  id: string;
  rentalId: string;
  receiptNumber: string;
  issuedAt: Date;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface StoredRentalChatMessage {
  id: string;
  rentalId: string;
  senderId: string;
  message: string;
  createdAt: Date;
}

export interface StoredUserIdentityVerification {
  id: string;
  userId: string;
  documentType: string;
  documentNumberHash: string;
  fullName: string;
  birthDate: Date;
  status: IdentityVerificationStatus;
  notes?: string;
  submittedAt: Date;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredPremiumSubscription {
  id: string;
  userId: string;
  status: PremiumSubscriptionStatus;
  amount: number;
  months: number;
  startsAt: Date;
  endsAt: Date;
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
  submitUserIdentityVerification(input: {
    userId: string;
    documentType: string;
    documentNumberHash: string;
    fullName: string;
    birthDate: Date;
  }): Promise<StoredUserIdentityVerification>;
  getUserIdentityVerification(userId: string): Promise<StoredUserIdentityVerification | null>;
  reviewUserIdentityVerification(input: {
    userId: string;
    status: IdentityVerificationStatus;
    notes?: string;
  }): Promise<StoredUserIdentityVerification | null>;
  createPremiumSubscription(input: {
    userId: string;
    amount: number;
    months: number;
    status?: PremiumSubscriptionStatus;
  }): Promise<StoredPremiumSubscription>;
  getLatestPremiumSubscription(userId: string): Promise<StoredPremiumSubscription | null>;

  createListingRecord(input: {
    ownerId: string;
    title: string;
    description: string;
    category?: string;
    city?: string;
    region?: string;
    dailyPrice: number;
    deliveryMode?: ListingDeliveryMode;
    bookingMode?: ListingBookingMode;
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
      category: string;
      city: string;
      region: string;
      dailyPrice: number;
      deliveryMode: ListingDeliveryMode;
      bookingMode: ListingBookingMode;
      status: ListingStatus;
      riskLevel: RiskLevel;
    }>
  ): Promise<StoredListing | null>;
  updateListingStatus(listingId: string, status: ListingStatus): Promise<StoredListing | null>;

  replaceListingAvailabilitySlots(input: {
    listingId: string;
    slots: Array<{
      date: Date;
      status: ListingAvailabilityStatus;
      pickupTime?: string;
      returnTime?: string;
    }>;
  }): Promise<StoredListingAvailabilitySlot[]>;
  listListingAvailabilityByListing(listingId: string): Promise<StoredListingAvailabilitySlot[]>;
  listListingAvailabilityRecords(): Promise<StoredListingAvailabilitySlot[]>;

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
    fulfillmentMethod?: RentalFulfillmentMethod;
    deliveryAddress?: string;
    platformFee?: number;
    depositAmount?: number;
    signalAmount?: number;
    remainderAmount?: number;
    status: RentalStatus;
  }): Promise<StoredRental>;
  getRentalById(rentalId: string): Promise<StoredRental | null>;
  listRentalRecords(): Promise<StoredRental[]>;
  listRentalsByUser(userId: string): Promise<StoredRental[]>;
  updateRentalStatus(rentalId: string, status: RentalStatus): Promise<StoredRental | null>;
  createRentalPaymentRecord(input: {
    rentalId: string;
    mode: RentalPaymentMode;
    status?: RentalPaymentStatus;
    totalAmount: number;
    platformFeeAmount: number;
    depositAmount: number;
    signalAmount: number;
    remainderAmount: number;
    paidAmount?: number;
    inAppPaymentReference?: string;
    proofUrl?: string;
  }): Promise<StoredRentalPayment>;
  getRentalPaymentByRentalId(rentalId: string): Promise<StoredRentalPayment | null>;
  updateRentalPaymentRecord(
    rentalId: string,
    input: Partial<{
      status: RentalPaymentStatus;
      paidAmount: number;
      inAppPaymentReference: string;
      proofUrl: string;
    }>
  ): Promise<StoredRentalPayment | null>;
  createRentalContractRecord(input: {
    rentalId: string;
    termsVersion: string;
    contractText: string;
    checksum: string;
  }): Promise<StoredRentalContract>;
  getRentalContractByRentalId(rentalId: string): Promise<StoredRentalContract | null>;
  acceptRentalContract(input: {
    rentalId: string;
    acceptedBy: "TENANT" | "OWNER";
  }): Promise<StoredRentalContract | null>;
  createRentalReceiptRecord(input: {
    rentalId: string;
    receiptNumber: string;
    issuedAt: Date;
    payload: Record<string, unknown>;
  }): Promise<StoredRentalReceipt>;
  getRentalReceiptByRentalId(rentalId: string): Promise<StoredRentalReceipt | null>;
  createRentalChatMessage(input: {
    rentalId: string;
    senderId: string;
    message: string;
  }): Promise<StoredRentalChatMessage>;
  listRentalChatMessages(rentalId: string): Promise<StoredRentalChatMessage[]>;

  findReviewByRentalAndReviewer(rentalId: string, reviewerId: string): Promise<StoredReview | null>;
  listReviewRecords(): Promise<StoredReview[]>;
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
  listBoostRecords(): Promise<StoredBoost[]>;
}
