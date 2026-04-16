import { randomUUID } from "node:crypto";
import { USER_ROLES, type UserRole } from "../../../shared/types/role";

export interface UserProps {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateUserInput {
  name: string;
  email: string;
  role?: UserRole;
  reputationScore?: number;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  static create(input: CreateUserInput): User {
    const role = input.role ?? "LOCATARIO";
    const reputationScore = input.reputationScore ?? 0;

    if (!USER_ROLES.includes(role)) {
      throw new Error("Invalid user role");
    }

    if (reputationScore < 0) {
      throw new Error("Reputation score cannot be negative");
    }

    const now = new Date();

    return new User({
      id: randomUUID(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role,
      reputationScore,
      createdAt: now,
      updatedAt: now
    });
  }

  get id(): string {
    return this.props.id;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get reputationScore(): number {
    return this.props.reputationScore;
  }
}
