import { describe, expect, it } from "vitest";
import { User } from "../../../../src/domain/users/entities/user";

describe("User entity", () => {
  it("should create user with default role LOCATARIO", () => {
    const user = User.create({
      name: "Maria",
      email: "maria@example.com"
    });

    expect(user.role).toBe("LOCATARIO");
  });

  it("should reject negative reputation score", () => {
    expect(() =>
      User.create({
        name: "Joao",
        email: "joao@example.com",
        reputationScore: -1
      })
    ).toThrowError("Reputation score cannot be negative");
  });
});
