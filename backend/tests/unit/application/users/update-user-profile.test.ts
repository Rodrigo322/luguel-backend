import { beforeEach, describe, expect, it } from "vitest";
import { updateCurrentUserProfile } from "../../../../src/application/users/update-user-profile";
import { resetInMemoryStore, upsertUserFromAuth } from "../../../../src/infra/persistence/in-memory-store";

describe("updateCurrentUserProfile", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should update user name", async () => {
    const user = await upsertUserFromAuth({
      id: "user-profile-1",
      email: "user-profile-1@example.com",
      name: "Nome Inicial"
    });

    const updated = await updateCurrentUserProfile({
      requesterId: user.id,
      name: "  Nome Atualizado  "
    });

    expect(updated.name).toBe("Nome Atualizado");
  });

  it("should reject invalid user name", async () => {
    const user = await upsertUserFromAuth({
      id: "user-profile-2",
      email: "user-profile-2@example.com",
      name: "Nome"
    });

    await expect(
      updateCurrentUserProfile({
        requesterId: user.id,
        name: "a"
      })
    ).rejects.toMatchObject({ code: "InvalidUserName" });
  });
});
