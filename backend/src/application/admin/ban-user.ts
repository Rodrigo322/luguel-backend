import { ensureCanBanUser } from "../../domain/admin/services/admin-rules";
import { DomainError } from "../../domain/shared/errors/domain-error";
import { banUser, createAdminAuditLogRecord, getUserById } from "../../infra/persistence/in-memory-store";

interface BanUserInput {
  adminId: string;
  userId: string;
  reason: string;
}

export async function banUserFlow(input: BanUserInput) {
  const user = await getUserById(input.userId);

  if (!user) {
    throw new DomainError("User not found.", 404, "UserNotFound");
  }

  ensureCanBanUser(user.isBanned);

  const banned = await banUser(user.id);

  if (!banned) {
    throw new DomainError("Unable to ban user.", 500, "UserBanFailed");
  }

  await createAdminAuditLogRecord({
    adminId: input.adminId,
    action: "USER_BANNED",
    entityType: "user",
    entityId: user.id,
    metadata: {
      reason: input.reason
    }
  });

  return banned;
}
