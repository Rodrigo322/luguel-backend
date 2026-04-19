import { DomainError } from "../../shared/errors/domain-error";

export function ensureValidRentalChatMessage(message: string): string {
  const normalized = message.trim();

  if (normalized.length < 1 || normalized.length > 2000) {
    throw new DomainError("Chat message must have between 1 and 2000 characters.", 400, "InvalidChatMessage");
  }

  return normalized;
}

