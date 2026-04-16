import { describe, expect, it } from "vitest";
import { ensureUserCanBeDeleted, ensureUserNameIsValid } from "../../../../src/domain/users/services/user-rules";

describe("user-rules", () => {
  it("should validate user name", () => {
    expect(() => ensureUserNameIsValid("a")).toThrowError(/between 2 and 120/);
    expect(ensureUserNameIsValid("  Maria  ")).toBe("Maria");
  });

  it("should block admin self-deletion", () => {
    expect(() => ensureUserCanBeDeleted(true)).toThrowError(/cannot be self-deleted/);
  });
});
