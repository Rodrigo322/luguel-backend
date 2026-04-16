import { DomainError } from "../../domain/shared/errors/domain-error";
import { ensureUserNameIsValid } from "../../domain/users/services/user-rules";
import { getUserById, updateUserProfile } from "../../infra/persistence/in-memory-store";

interface UpdateCurrentUserProfileInput {
  requesterId: string;
  name: string;
}

export async function updateCurrentUserProfile(input: UpdateCurrentUserProfileInput) {
  const user = await getUserById(input.requesterId);

  if (!user) {
    throw new DomainError("User not found.", 404, "UserNotFound");
  }

  const normalizedName = ensureUserNameIsValid(input.name);
  const updated = await updateUserProfile(user.id, { name: normalizedName });

  if (!updated) {
    throw new DomainError("User not found after update operation.", 404, "UserNotFound");
  }

  return updated;
}
