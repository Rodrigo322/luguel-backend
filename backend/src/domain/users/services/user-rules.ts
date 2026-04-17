import { DomainError } from "../../shared/errors/domain-error";

export function ensureUserCanBeDeleted(isAdmin: boolean): void {
  if (isAdmin) {
    throw new DomainError("Admin account cannot be self-deleted by endpoint.", 400, "AdminSelfDeletionForbidden");
  }
}

export function ensureUserNameIsValid(name: string): string {
  const normalized = name.trim();

  if (normalized.length < 2 || normalized.length > 120) {
    throw new DomainError("Name must have between 2 and 120 characters.", 400, "InvalidUserName");
  }

  return normalized;
}
