import { beforeEach, describe, expect, it } from "vitest";
import { deleteCurrentUser } from "../../../../src/application/users/delete-current-user";
import { getUserById, resetInMemoryStore, upsertUserFromAuth } from "../../../../src/infra/persistence/in-memory-store";

describe("deleteCurrentUser", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should delete non-admin user", async () => {
    const user = await upsertUserFromAuth({
      id: "delete-user-1",
      email: "delete-user-1@example.com",
      name: "Delete User"
    });

    await deleteCurrentUser({ requesterId: user.id });

    const deleted = await getUserById(user.id);
    expect(deleted).toBeNull();
  });

  it("should block admin self deletion", async () => {
    const admin = await upsertUserFromAuth({
      id: "delete-admin-1",
      email: "admin@example.com",
      name: "Admin Delete"
    });

    expect(admin.role).toBe("ADMIN");

    await expect(deleteCurrentUser({ requesterId: admin.id })).rejects.toMatchObject({
      code: "AdminSelfDeletionForbidden"
    });
  });
});
