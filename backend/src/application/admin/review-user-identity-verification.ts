import { DomainError } from "../../domain/shared/errors/domain-error";
import { ensureIdentityReviewStatusValid } from "../../domain/users/services/identity-verification-rules";
import {
  getUserById,
  reviewUserIdentityVerification
} from "../../infra/persistence/in-memory-store";

interface ReviewUserIdentityVerificationInput {
  adminId: string;
  userId: string;
  status: "VERIFIED" | "REJECTED";
  notes?: string;
}

export async function reviewUserIdentityVerificationByAdmin(
  input: ReviewUserIdentityVerificationInput
) {
  const admin = await getUserById(input.adminId);

  if (!admin) {
    throw new DomainError("Admin not found.", 404, "AdminNotFound");
  }

  if (admin.role !== "ADMIN") {
    throw new DomainError("Only admin can review identity verification.", 403, "AdminForbidden");
  }

  const targetUser = await getUserById(input.userId);

  if (!targetUser) {
    throw new DomainError("User not found.", 404, "UserNotFound");
  }

  ensureIdentityReviewStatusValid(input.status);

  const reviewed = await reviewUserIdentityVerification({
    userId: targetUser.id,
    status: input.status,
    notes: input.notes
  });

  if (!reviewed) {
    throw new DomainError("Identity verification request not found.", 404, "IdentityVerificationNotFound");
  }

  return reviewed;
}
