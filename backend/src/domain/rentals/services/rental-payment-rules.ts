import { DomainError } from "../../shared/errors/domain-error";
import type { RentalPaymentMode, RentalPaymentStatus } from "../entities/rental-payment";

const DEFAULT_COMMISSION_RATE = 0.12;
const PREMIUM_COMMISSION_RATE = 0.08;

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function ensureValidMonetaryAmount(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainError(`${field} must be a positive monetary amount.`, 400, "InvalidMonetaryAmount");
  }

  return roundCurrency(value);
}

export function calculatePlatformFee(totalPrice: number, ownerHasPremiumPlan: boolean): number {
  const rate = ownerHasPremiumPlan ? PREMIUM_COMMISSION_RATE : DEFAULT_COMMISSION_RATE;
  return roundCurrency(totalPrice * rate);
}

export function calculatePaymentBreakdown(input: {
  totalPrice: number;
  paymentMode: RentalPaymentMode;
  depositAmount?: number;
  signalAmount?: number;
  ownerHasPremiumPlan: boolean;
}): {
  totalAmount: number;
  platformFeeAmount: number;
  depositAmount: number;
  signalAmount: number;
  remainderAmount: number;
} {
  const totalPrice = ensureValidMonetaryAmount(input.totalPrice, "totalPrice");
  const depositAmount = ensureValidMonetaryAmount(input.depositAmount ?? 0, "depositAmount");
  const platformFeeAmount = calculatePlatformFee(totalPrice, input.ownerHasPremiumPlan);
  const totalAmount = roundCurrency(totalPrice + depositAmount);

  if (input.paymentMode === "IN_APP_FULL") {
    return {
      totalAmount,
      platformFeeAmount,
      depositAmount,
      signalAmount: totalAmount,
      remainderAmount: 0
    };
  }

  const minimumSignalAmount = roundCurrency(Math.max(platformFeeAmount, totalAmount * 0.2));
  const informedSignalAmount = input.signalAmount ?? minimumSignalAmount;
  const signalAmount = ensureValidMonetaryAmount(informedSignalAmount, "signalAmount");

  if (signalAmount < minimumSignalAmount || signalAmount >= totalAmount) {
    throw new DomainError(
      "Signal amount for split payment must be at least 20% (or platform fee) and lower than total amount.",
      400,
      "InvalidSignalAmount"
    );
  }

  return {
    totalAmount,
    platformFeeAmount,
    depositAmount,
    signalAmount,
    remainderAmount: roundCurrency(totalAmount - signalAmount)
  };
}

export function resolveRentalPaymentStatus(input: {
  paidAmount: number;
  signalAmount: number;
  totalAmount: number;
}): RentalPaymentStatus {
  const paidAmount = ensureValidMonetaryAmount(input.paidAmount, "paidAmount");
  const signalAmount = ensureValidMonetaryAmount(input.signalAmount, "signalAmount");
  const totalAmount = ensureValidMonetaryAmount(input.totalAmount, "totalAmount");

  if (paidAmount >= totalAmount) {
    return "PAID";
  }

  if (signalAmount > 0 && paidAmount >= signalAmount) {
    return "PARTIALLY_PAID";
  }

  return "PENDING";
}

