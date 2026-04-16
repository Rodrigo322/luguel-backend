import type { UserRole } from "../../shared/types/role";
import { env } from "../../shared/config/env";

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthUserInput {
  id: string;
  email: string;
  name: string;
}

const adminEmails = new Set(
  env.ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const usersById = new Map<string, StoredUser>();
const usersByEmail = new Map<string, StoredUser>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resetInMemoryStore(): void {
  usersById.clear();
  usersByEmail.clear();
}

export function upsertUserFromAuth(input: AuthUserInput): StoredUser {
  const email = normalizeEmail(input.email);
  const now = new Date();

  const existing = usersById.get(input.id) ?? usersByEmail.get(email);

  if (existing) {
    const updated: StoredUser = {
      ...existing,
      name: input.name,
      email,
      updatedAt: now
    };
    usersById.set(updated.id, updated);
    usersByEmail.set(email, updated);
    return updated;
  }

  const created: StoredUser = {
    id: input.id,
    email,
    name: input.name,
    role: adminEmails.has(email) ? "ADMIN" : "LOCATARIO",
    reputationScore: 0,
    createdAt: now,
    updatedAt: now
  };

  usersById.set(created.id, created);
  usersByEmail.set(email, created);

  return created;
}

export function getUserById(userId: string): StoredUser | null {
  return usersById.get(userId) ?? null;
}

export function updateUserRole(userId: string, role: Extract<UserRole, "LOCADOR" | "LOCATARIO">): StoredUser | null {
  const existing = usersById.get(userId);

  if (!existing) {
    return null;
  }

  const updated: StoredUser = {
    ...existing,
    role,
    updatedAt: new Date()
  };

  usersById.set(updated.id, updated);
  usersByEmail.set(updated.email, updated);

  return updated;
}
