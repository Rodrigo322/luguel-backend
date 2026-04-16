import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPasswordResetLinkForTesting } from "../../../src/interfaces/http/auth/create-auth";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Auth password recovery and session refresh", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should recover password and refresh authenticated session", async () => {
    await request(app.server).post("/api/v1/auth/signup").send({
      name: "Recovery User",
      email: "recovery-user@example.com",
      password: "StrongPass123!"
    });

    const forgotExisting = await request(app.server).post("/api/v1/auth/password/forgot").send({
      email: "recovery-user@example.com"
    });

    const forgotMissing = await request(app.server).post("/api/v1/auth/password/forgot").send({
      email: "missing-user@example.com"
    });

    expect(forgotExisting.statusCode).toBe(200);
    expect(forgotMissing.statusCode).toBe(200);
    expect(forgotExisting.body.message).toBe(forgotMissing.body.message);

    const resetUrl = getPasswordResetLinkForTesting("recovery-user@example.com");
    expect(resetUrl).toBeDefined();

    const token = resetUrl?.match(/\/reset-password\/([^?]+)/)?.[1];
    expect(token).toBeDefined();

    const passwordReset = await request(app.server).post("/api/v1/auth/password/reset").send({
      token,
      newPassword: "StrongPass456!"
    });

    expect(passwordReset.statusCode).toBe(200);

    const signinOldPassword = await request(app.server).post("/api/v1/auth/signin").send({
      email: "recovery-user@example.com",
      password: "StrongPass123!"
    });

    expect(signinOldPassword.statusCode).toBe(401);

    const signinNewPassword = await request(app.server).post("/api/v1/auth/signin").send({
      email: "recovery-user@example.com",
      password: "StrongPass456!"
    });

    expect(signinNewPassword.statusCode).toBe(200);

    const userCookie = signinNewPassword.headers["set-cookie"];

    const refreshSession = await request(app.server)
      .post("/api/v1/auth/session/refresh")
      .set("Cookie", userCookie);

    expect(refreshSession.statusCode).toBe(200);
    expect(refreshSession.body.user.email).toBe("recovery-user@example.com");
  });
});
