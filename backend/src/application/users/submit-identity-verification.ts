import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  ensureIdentityDocumentNumberValid,
  ensureIdentityDocumentTypeValid,
  ensureIdentityFullNameValid,
  hashIdentityDocumentNumber
} from "../../domain/users/services/identity-verification-rules";
import {
  getUserById,
  submitUserIdentityVerification
} from "../../infra/persistence/in-memory-store";

interface SubmitIdentityVerificationInput {
  requesterId: string;
  documentType: string;
  documentNumber: string;
  fullName: string;
  birthDate: Date;
}

export async function submitIdentityVerificationFlow(input: SubmitIdentityVerificationInput) {
  const user = await getUserById(input.requesterId);

  if (!user) {
    throw new DomainError("User not found.", 404, "UserNotFound");
  }

  const documentType = ensureIdentityDocumentTypeValid(input.documentType);
  const documentNumber = ensureIdentityDocumentNumberValid(input.documentNumber);
  const fullName = ensureIdentityFullNameValid(input.fullName);

  return submitUserIdentityVerification({
    userId: user.id,
    documentType,
    documentNumberHash: hashIdentityDocumentNumber(documentNumber),
    fullName,
    birthDate: input.birthDate
  });
}

