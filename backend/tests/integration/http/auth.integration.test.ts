import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Auth routes", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should signup and fetch authenticated session", async () => {
    const signUpResponse = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Ana",
      email: "ana@example.com",
      password: "StrongPass123!"
    });

    expect(signUpResponse.statusCode).toBe(201);
    expect(signUpResponse.body.user.email).toBe("ana@example.com");

    const setCookie = signUpResponse.headers["set-cookie"];
    expect(setCookie).toBeDefined();

    const sessionResponse = await request(app.server)
      .get("/api/v1/auth/session")
      .set("Cookie", setCookie);

    expect(sessionResponse.statusCode).toBe(200);
    expect(sessionResponse.body.user).toMatchObject({
      email: "ana@example.com",
      role: "LOCATARIO"
    });
  });

  it("should not leak details on invalid signin", async () => {
    const signinResponse = await request(app.server).post("/api/v1/auth/signin").send({
      email: "not-found@example.com",
      password: "WrongPass123!"
    });

    expect(signinResponse.statusCode).toBe(401);
    expect(signinResponse.body).toEqual({
      error: "InvalidCredentials",
      message: "Invalid credentials."
    });
  });
});
