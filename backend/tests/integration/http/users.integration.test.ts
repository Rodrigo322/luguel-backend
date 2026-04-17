import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Users routes", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should manage own profile and support admin user listing", async () => {
    const signUp = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Maria",
      email: "maria-users@example.com",
      password: "StrongPass123!"
    });

    expect(signUp.statusCode).toBe(201);

    const userCookie = signUp.headers["set-cookie"];
    const userId = signUp.body.user.id as string;

    const me = await request(app.server).get("/api/v1/users/me").set("Cookie", userCookie);

    expect(me.statusCode).toBe(200);
    expect(me.body).toMatchObject({
      id: userId,
      email: "maria-users@example.com",
      role: "LOCATARIO",
      isBanned: false
    });

    const updateProfile = await request(app.server).patch("/api/v1/users/me").set("Cookie", userCookie).send({
      name: "Maria Atualizada"
    });

    expect(updateProfile.statusCode).toBe(200);
    expect(updateProfile.body.name).toBe("Maria Atualizada");

    const updateRole = await request(app.server).patch("/api/v1/users/me/role").set("Cookie", userCookie).send({
      role: "LOCADOR"
    });

    expect(updateRole.statusCode).toBe(200);
    expect(updateRole.body.role).toBe("LOCADOR");

    const adminSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Admin Users",
      email: "admin@example.com",
      password: "StrongPass123!"
    });

    const adminCookie = adminSignup.headers["set-cookie"];

    const usersList = await request(app.server).get("/api/v1/users").set("Cookie", adminCookie);

    expect(usersList.statusCode).toBe(200);
    expect(usersList.body.users.some((user: { email: string }) => user.email === "maria-users@example.com")).toBe(
      true
    );

    const userById = await request(app.server).get(`/api/v1/users/${userId}`).set("Cookie", adminCookie);

    expect(userById.statusCode).toBe(200);
    expect(userById.body.id).toBe(userId);

    const deleteAccount = await request(app.server).delete("/api/v1/users/me").set("Cookie", userCookie);

    expect(deleteAccount.statusCode).toBe(204);
  });
});
