import { createHash } from "node:crypto";
import { DomainError } from "../../shared/errors/domain-error";
import type { IdentityVerificationStatus } from "../entities/user-identity-verification";

const ALLOWED_DOCUMENT_TYPES = ["CPF", "CNPJ", "RG", "CNH", "PASSPORT"] as const;

export function ensureIdentityDocumentTypeValid(documentType: string): string {
  const normalized = documentType.trim().toUpperCase();

  if (!ALLOWED_DOCUMENT_TYPES.includes(normalized as (typeof ALLOWED_DOCUMENT_TYPES)[number])) {
    throw new DomainError("Unsupported document type for identity verification.", 400, "InvalidDocumentType");
  }

  return normalized;
}

export function ensureIdentityDocumentNumberValid(documentNumber: string): string {
  const normalized = documentNumber.replace(/\s+/g, "").trim();

  if (normalized.length < 5 || normalized.length > 40) {
    throw new DomainError("Document number must have between 5 and 40 characters.", 400, "InvalidDocumentNumber");
  }

  return normalized;
}

export function ensureIdentityFullNameValid(fullName: string): string {
  const normalized = fullName.trim();

  if (normalized.length < 5 || normalized.length > 180) {
    throw new DomainError("Full name must have between 5 and 180 characters.", 400, "InvalidFullName");
  }

  return normalized;
}

export function hashIdentityDocumentNumber(documentNumber: string): string {
  return createHash("sha256").update(documentNumber).digest("hex");
}

export function ensureIdentityReviewStatusValid(status: IdentityVerificationStatus): void {
  if (status === "PENDING") {
    throw new DomainError("Admin review must set status to VERIFIED or REJECTED.", 400, "InvalidReviewStatus");
  }
}

