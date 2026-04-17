import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/build-test-app";

describe("Users authorization flow (E2E)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should block profile route without session", async () => {
    const response = await request(app.server).get("/api/v1/users/me");

    expect(response.statusCode).toBe(401);
  });

  it("should access and update own role when authenticated", async () => {
    const signUp = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Carlos",
      email: "carlos@example.com",
      password: "StrongPass123!"
    });

    const cookie = signUp.headers["set-cookie"];

    const profileResponse = await request(app.server).get("/api/v1/users/me").set("Cookie", cookie);

    expect(profileResponse.statusCode).toBe(200);
    expect(profileResponse.body.role).toBe("LOCATARIO");

    const roleUpdateResponse = await request(app.server)
      .patch("/api/v1/users/me/role")
      .set("Cookie", cookie)
      .send({ role: "LOCADOR" });

    expect(roleUpdateResponse.statusCode).toBe(200);
    expect(roleUpdateResponse.body.role).toBe("LOCADOR");
  });
});
