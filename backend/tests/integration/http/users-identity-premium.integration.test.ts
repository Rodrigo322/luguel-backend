import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Users identity verification and premium", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should submit identity verification, allow admin review and subscribe premium for advertiser", async () => {
    const userSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "User Identity",
      email: "user-identity@example.com",
      password: "StrongPass123!"
    });

    expect(userSignup.statusCode).toBe(201);
    const userCookie = userSignup.headers["set-cookie"];
    const userId = userSignup.body.user.id as string;

    const identitySubmit = await request(app.server)
      .post("/api/v1/users/me/identity-verification")
      .set("Cookie", userCookie)
      .send({
        documentType: "CPF",
        documentNumber: "12345678901",
        fullName: "Usuario Teste Silva",
        birthDate: new Date("1992-02-10T00:00:00.000Z").toISOString()
      });

    expect(identitySubmit.statusCode).toBe(200);
    expect(identitySubmit.body.status).toBe("PENDING");
    expect(identitySubmit.body.userId).toBe(userId);

    const adminSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Admin Identity",
      email: "admin@example.com",
      password: "StrongPass123!"
    });
    const adminCookie = adminSignup.headers["set-cookie"];

    const identityReview = await request(app.server)
      .patch(`/api/v1/admin/users/${userId}/identity-verification`)
      .set("Cookie", adminCookie)
      .send({
        status: "VERIFIED",
        notes: "Documento validado sem inconsistencias."
      });

    expect(identityReview.statusCode).toBe(200);
    expect(identityReview.body.status).toBe("VERIFIED");

    const meAfterReview = await request(app.server).get("/api/v1/users/me").set("Cookie", userCookie);

    expect(meAfterReview.statusCode).toBe(200);
    expect(meAfterReview.body.identityVerificationStatus).toBe("VERIFIED");
    expect(meAfterReview.body.identityVerifiedAt).toBeDefined();

    const premiumBeforeRole = await request(app.server)
      .post("/api/v1/users/me/premium/subscribe")
      .set("Cookie", userCookie)
      .send({
        months: 3,
        amount: 129.9,
        paymentConfirmed: true
      });

    expect(premiumBeforeRole.statusCode).toBe(403);

    const toAdvertiserRole = await request(app.server)
      .patch("/api/v1/users/me/role")
      .set("Cookie", userCookie)
      .send({ role: "LOCADOR" });

    expect(toAdvertiserRole.statusCode).toBe(200);
    expect(toAdvertiserRole.body.role).toBe("LOCADOR");

    const premiumStatusBeforeSubscribe = await request(app.server)
      .get("/api/v1/users/me/premium")
      .set("Cookie", userCookie);

    expect(premiumStatusBeforeSubscribe.statusCode).toBe(200);
    expect(premiumStatusBeforeSubscribe.body.plan).toBe("FREE");
    expect(premiumStatusBeforeSubscribe.body.subscription).toBeNull();

    const premiumSubscribe = await request(app.server)
      .post("/api/v1/users/me/premium/subscribe")
      .set("Cookie", userCookie)
      .send({
        months: 3,
        amount: 129.9,
        paymentConfirmed: true
      });

    expect(premiumSubscribe.statusCode).toBe(201);
    expect(premiumSubscribe.body.plan).toBe("PREMIUM");
    expect(premiumSubscribe.body.subscription.status).toBe("ACTIVE");

    const premiumStatus = await request(app.server).get("/api/v1/users/me/premium").set("Cookie", userCookie);

    expect(premiumStatus.statusCode).toBe(200);
    expect(premiumStatus.body.plan).toBe("PREMIUM");
    expect(premiumStatus.body.subscription.months).toBe(3);

    const adminMetrics = await request(app.server).get("/api/v1/admin/metrics").set("Cookie", adminCookie);

    expect(adminMetrics.statusCode).toBe(200);
    expect(adminMetrics.body.verifiedUsers).toBeGreaterThanOrEqual(1);
    expect(adminMetrics.body.premiumAdvertisers).toBeGreaterThanOrEqual(1);
  });
});
