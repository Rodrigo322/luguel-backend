import { DomainError } from "../../domain/shared/errors/domain-error";
import { ensureUserCanBeDeleted } from "../../domain/users/services/user-rules";
import { deleteUserById, getUserById } from "../../infra/persistence/in-memory-store";

interface DeleteCurrentUserInput {
  requesterId: string;
}

export async function deleteCurrentUser(input: DeleteCurrentUserInput): Promise<void> {
  const user = await getUserById(input.requesterId);

  if (!user) {
    throw new DomainError("User not found.", 404, "UserNotFound");
  }

  ensureUserCanBeDeleted(user.role === "ADMIN");

  const deleted = await deleteUserById(user.id);

  if (!deleted) {
    throw new DomainError("Unable to delete user account.", 500, "UserDeleteFailed");
  }
}
