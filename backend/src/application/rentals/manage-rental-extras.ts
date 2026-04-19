import { randomUUID } from "node:crypto";
import { ensureValidRentalChatMessage } from "../../domain/rentals/services/rental-chat-rules";
import { ensureContractAcceptableByActor } from "../../domain/rentals/services/rental-contract-rules";
import { resolveRentalPaymentStatus } from "../../domain/rentals/services/rental-payment-rules";
import { ensureRentalReadAccess } from "../../domain/rentals/services/rental-rules";
import { DomainError } from "../../domain/shared/errors/domain-error";
import type { UserRole } from "../../shared/types/role";
import {
  acceptRentalContract,
  createRentalChatMessage,
  createRentalReceiptRecord,
  getListingById,
  getRentalById,
  getRentalContractByRentalId,
  getRentalPaymentByRentalId,
  getRentalReceiptByRentalId,
  listRentalChatMessages,
  updateRentalPaymentRecord
} from "../../infra/persistence/in-memory-store";

async function ensureRentalParticipantAccess(input: {
  requesterId: string;
  requesterRole: UserRole;
  rentalId: string;
}) {
  const rental = await getRentalById(input.rentalId);

  if (!rental) {
    throw new DomainError("Rental not found.", 404, "RentalNotFound");
  }

  const listing = await getListingById(rental.listingId);

  if (!listing) {
    throw new DomainError("Listing not found.", 404, "ListingNotFound");
  }

  ensureRentalReadAccess({
    requesterId: input.requesterId,
    requesterRole: input.requesterRole,
    rentalTenantId: rental.tenantId,
    listingOwnerId: listing.ownerId
  });

  return { rental, listing };
}

export async function getRentalPaymentDetails(input: {
  requesterId: string;
  requesterRole: UserRole;
  rentalId: string;
}) {
  await ensureRentalParticipantAccess(input);

  const payment = await getRentalPaymentByRentalId(input.rentalId);

  if (!payment) {
    throw new DomainError("Rental payment not found.", 404, "RentalPaymentNotFound");
  }

  return payment;
}

export async function confirmRentalPayment(input: {
  requesterId: string;
  requesterRole: UserRole;
  rentalId: string;
  amount: number;
  inAppPaymentReference?: string;
  proofUrl?: string;
}) {
  const { rental, listing } = await ensureRentalParticipantAccess(input);
  const payment = await getRentalPaymentByRentalId(input.rentalId);

  if (!payment) {
    throw new DomainError("Rental payment not found.", 404, "RentalPaymentNotFound");
  }

  const isAdmin = input.requesterRole === "ADMIN";
  const isTenant = rental.tenantId === input.requesterId;
  const isOwner = listing.ownerId === input.requesterId;

  if (!isAdmin && !isTenant && !isOwner) {
    throw new DomainError("User is not allowed to confirm payment for this rental.", 403, "RentalPaymentForbidden");
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new DomainError("Payment amount must be greater than zero.", 400, "InvalidPaymentAmount");
  }

  const paidAmount = Math.min(payment.totalAmount, payment.paidAmount + input.amount);
  const status = resolveRentalPaymentStatus({
    paidAmount,
    signalAmount: payment.signalAmount,
    totalAmount: payment.totalAmount
  });

  const updatedPayment = await updateRentalPaymentRecord(input.rentalId, {
    paidAmount,
    status,
    inAppPaymentReference: input.inAppPaymentReference,
    proofUrl: input.proofUrl
  });

  if (!updatedPayment) {
    throw new DomainError("Unable to update rental payment.", 500, "RentalPaymentUpdateFailed");
  }

  let receipt = await getRentalReceiptByRentalId(input.rentalId);

  if (!receipt && status === "PAID") {
    receipt = await createRentalReceiptRecord({
      rentalId: input.rentalId,
      receiptNumber: `LUG-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
      issuedAt: new Date(),
      payload: {
        rentalId: rental.id,
        listingId: rental.listingId,
        tenantId: rental.tenantId,
        amountPaid: paidAmount,
        totalAmount: payment.totalAmount,
        platformFeeAmount: payment.platformFeeAmount,
        depositAmount: payment.depositAmount,
        paymentMode: payment.mode
      }
    });
  }

  return {
    payment: updatedPayment,
    receipt
  };
}

export async function getRentalContractDetails(input: {
  requesterId: string;
  requesterRole: UserRole;
  rentalId: string;
}) {
  await ensureRentalParticipantAccess(input);

  const contract = await getRentalContractByRentalId(input.rentalId);

  if (!contract) {
    throw new DomainError("Rental contract not found.", 404, "RentalContractNotFound");
  }

  return contract;
}

export async function acceptRentalContractByActor(input: {
  requesterId: string;
  requesterRole: UserRole;
  rentalId: string;
}) {
  const { rental, listing } = await ensureRentalParticipantAccess(input);

  if (input.requesterRole === "ADMIN") {
    ensureContractAcceptableByActor({
      requesterRole: "ADMIN"
    });
  }

  let acceptedBy: "TENANT" | "OWNER" | null = null;

  if (rental.tenantId === input.requesterId) {
    acceptedBy = "TENANT";
  } else if (listing.ownerId === input.requesterId) {
    acceptedBy = "OWNER";
  }

  if (!acceptedBy) {
    throw new DomainError("Only tenant or owner can accept this contract.", 403, "ContractAcceptForbidden");
  }

  const contract = await acceptRentalContract({
    rentalId: input.rentalId,
    acceptedBy
  });

  if (!contract) {
    throw new DomainError("Rental contract not found.", 404, "RentalContractNotFound");
  }

  return contract;
}

export async function getRentalReceiptDetails(input: {
  requesterId: string;
  requesterRole: UserRole;
  rentalId: string;
}) {
  await ensureRentalParticipantAccess(input);

  const receipt = await getRentalReceiptByRentalId(input.rentalId);

  if (!receipt) {
    throw new DomainError("Rental receipt not found.", 404, "RentalReceiptNotFound");
  }

  return receipt;
}

export async function listRentalInternalChat(input: {
  requesterId: string;
  requesterRole: UserRole;
  rentalId: string;
}) {
  await ensureRentalParticipantAccess(input);
  return listRentalChatMessages(input.rentalId);
}

export async function sendRentalInternalChatMessage(input: {
  requesterId: string;
  requesterRole: UserRole;
  rentalId: string;
  message: string;
}) {
  await ensureRentalParticipantAccess(input);

  const message = ensureValidRentalChatMessage(input.message);
  return createRentalChatMessage({
    rentalId: input.rentalId,
    senderId: input.requesterId,
    message
  });
}

