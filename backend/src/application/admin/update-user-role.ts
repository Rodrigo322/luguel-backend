import { DomainError } from "../../domain/shared/errors/domain-error";
import {
  createAdminAuditLogRecord,
  getUserById,
  updateUserRole
} from "../../infra/persistence/in-memory-store";
import type { UserRole } from "../../shared/types/role";

interface UpdateUserRoleByAdminInput {
  adminId: string;
  userId: string;
  role: Extract<UserRole, "LOCADOR" | "LOCATARIO">;
}

export async function updateUserRoleByAdmin(input: UpdateUserRoleByAdminInput) {
  const user = await getUserById(input.userId);

  if (!user) {
    throw new DomainError("User not found.", 404, "UserNotFound");
  }

  if (user.role === "ADMIN") {
    throw new DomainError("Admin role cannot be changed by this endpoint.", 400, "AdminRoleProtected");
  }

  const updated = await updateUserRole(user.id, input.role);

  if (!updated) {
    throw new DomainError("Unable to update user role.", 500, "UserRoleUpdateFailed");
  }

  await createAdminAuditLogRecord({
    adminId: input.adminId,
    action: "USER_ROLE_UPDATED_BY_ADMIN",
    entityType: "user",
    entityId: user.id,
    metadata: {
      previousRole: user.role,
      newRole: updated.role
    }
  });

  return updated;
}
