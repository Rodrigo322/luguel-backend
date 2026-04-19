import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  calculateRentalDays,
  ensureListingAvailableForRental,
  ensureNotSelfRental,
  ensureValidRentalPeriod
} from "../../domain/rentals/services/rental-rules";
import { calculatePaymentBreakdown } from "../../domain/rentals/services/rental-payment-rules";
import { ensureRentalFulfillmentAllowed } from "../../domain/rentals/services/rental-logistics-rules";
import {
  buildRentalContractText,
  generateContractChecksum
} from "../../domain/rentals/services/rental-contract-rules";
import type {
  RentalFulfillmentMethod,
  RentalPaymentMode
} from "../../domain/rentals/entities/rental-payment";
import {
  createRentalContractRecord,
  createRentalPaymentRecord,
  createRentalRecord,
  getListingById,
  getUserById
} from "../../infra/persistence/in-memory-store";

interface RequestRentalInput {
  tenantId: string;
  listingId: string;
  startDate: Date;
  endDate: Date;
  paymentMode?: RentalPaymentMode;
  depositAmount?: number;
  signalAmount?: number;
  fulfillmentMethod?: RentalFulfillmentMethod;
  deliveryAddress?: string;
}

export async function requestRental(input: RequestRentalInput) {
  const tenant = await getUserById(input.tenantId);

  if (!tenant) {
    throw new DomainError("Tenant not found.", 404, "TenantNotFound");
  }

  if (tenant.isBanned) {
    throw new DomainError("Banned user cannot request rentals.", 403, "BannedUserForbidden");
  }

  const listing = await getListingById(input.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureListingAvailableForRental(listing.status);

  ensureNotSelfRental(listing.ownerId, tenant.id);

  ensureValidRentalPeriod(input.startDate, input.endDate);

  const owner = await getUserById(listing.ownerId);

  if (!owner) {
    throw new DomainError("Listing owner not found.", 404, "ListingOwnerNotFound");
  }

  const fulfillmentMethod = input.fulfillmentMethod ?? "PICKUP_LOCAL";
  ensureRentalFulfillmentAllowed({
    listingDeliveryMode: listing.deliveryMode,
    fulfillmentMethod,
    deliveryAddress: input.deliveryAddress
  });

  const rentalDays = calculateRentalDays(input.startDate, input.endDate);
  const totalPrice = rentalDays * listing.dailyPrice;
  const paymentMode = input.paymentMode ?? "IN_APP_FULL";
  const ownerHasPremiumPlan =
    owner.plan === "PREMIUM" && (!!owner.planExpiresAt ? owner.planExpiresAt.getTime() > Date.now() : false);

  const paymentBreakdown = calculatePaymentBreakdown({
    totalPrice,
    paymentMode,
    depositAmount: input.depositAmount,
    signalAmount: input.signalAmount,
    ownerHasPremiumPlan
  });

  const rental = await createRentalRecord({
    listingId: listing.id,
    tenantId: tenant.id,
    startDate: input.startDate,
    endDate: input.endDate,
    totalPrice,
    fulfillmentMethod,
    deliveryAddress: input.deliveryAddress?.trim() || undefined,
    platformFee: paymentBreakdown.platformFeeAmount,
    depositAmount: paymentBreakdown.depositAmount,
    signalAmount: paymentBreakdown.signalAmount,
    remainderAmount: paymentBreakdown.remainderAmount,
    status: "REQUESTED"
  });

  await createRentalPaymentRecord({
    rentalId: rental.id,
    mode: paymentMode,
    status: "PENDING",
    totalAmount: paymentBreakdown.totalAmount,
    platformFeeAmount: paymentBreakdown.platformFeeAmount,
    depositAmount: paymentBreakdown.depositAmount,
    signalAmount: paymentBreakdown.signalAmount,
    remainderAmount: paymentBreakdown.remainderAmount,
    paidAmount: 0
  });

  const contractText = buildRentalContractText({
    rentalId: rental.id,
    listingId: listing.id,
    tenantId: tenant.id,
    ownerId: owner.id,
    startDate: input.startDate,
    endDate: input.endDate,
    totalPrice,
    depositAmount: paymentBreakdown.depositAmount
  });

  await createRentalContractRecord({
    rentalId: rental.id,
    termsVersion: "v1.0",
    contractText,
    checksum: generateContractChecksum(contractText)
  });

  return rental;
}
