import { beforeEach, describe, expect, it } from "vitest";
import { banUserFlow } from "../../../../src/application/admin/ban-user";
import { resetInMemoryStore, upsertUserFromAuth } from "../../../../src/infra/persistence/in-memory-store";

describe("banUserFlow", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should ban a user", async () => {
    const user = await upsertUserFromAuth({
      id: "ban-user-1",
      email: "ban-user-1@example.com",
      name: "Ban User"
    });

    const banned = await banUserFlow({
      adminId: "admin-id",
      userId: user.id,
      reason: "Violacao de politica"
    });

    expect(banned.isBanned).toBe(true);
    expect(banned.bannedAt).toBeDefined();
  });

  it("should reject already banned user", async () => {
    const user = await upsertUserFromAuth({
      id: "ban-user-2",
      email: "ban-user-2@example.com",
      name: "Ban User 2"
    });

    await banUserFlow({
      adminId: "admin-id",
      userId: user.id,
      reason: "Primeiro ban"
    });

    await expect(
      banUserFlow({
        adminId: "admin-id",
        userId: user.id,
        reason: "Segundo ban"
      })
    ).rejects.toMatchObject({ code: "UserAlreadyBanned" });
  });
});
