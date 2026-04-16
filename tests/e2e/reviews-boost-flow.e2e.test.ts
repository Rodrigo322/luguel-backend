import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/build-test-app";

describe("Reviews and boost flow (E2E)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should complete rental, update reputation and activate boost", async () => {
    const ownerSignUp = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner Boost",
      email: "owner-boost@example.com",
      password: "StrongPass123!"
    });
    const ownerCookie = ownerSignUp.headers["set-cookie"];

    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerCookie).send({
      role: "LOCADOR"
    });

    const listingCreate = await request(app.server).post("/api/v1/listings").set("Cookie", ownerCookie).send({
      title: "Apartamento com contrato digital",
      description: "Anuncio regular com contrato digital e pagamento via plataforma.",
      dailyPrice: 240
    });
    const listingId = listingCreate.body.listing.id as string;

    const tenantSignUp = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Tenant Boost",
      email: "tenant-boost@example.com",
      password: "StrongPass123!"
    });
    const tenantCookie = tenantSignUp.headers["set-cookie"];

    const rentalCreate = await request(app.server).post("/api/v1/rentals").set("Cookie", tenantCookie).send({
      listingId,
      startDate: new Date("2026-06-01T00:00:00.000Z").toISOString(),
      endDate: new Date("2026-06-04T00:00:00.000Z").toISOString()
    });
    const rentalId = rentalCreate.body.id as string;

    const rentalComplete = await request(app.server)
      .patch(`/api/v1/rentals/${rentalId}/status`)
      .set("Cookie", ownerCookie)
      .send({ status: "COMPLETED" });

    expect(rentalComplete.statusCode).toBe(200);
    expect(rentalComplete.body.status).toBe("COMPLETED");

    const reviewCreate = await request(app.server).post("/api/v1/reviews").set("Cookie", tenantCookie).send({
      listingId,
      rentalId,
      rating: 5,
      comment: "Excelente experiência de locação."
    });

    expect(reviewCreate.statusCode).toBe(201);
    expect(reviewCreate.body.rating).toBe(5);

    const ownerProfile = await request(app.server).get("/api/v1/users/me").set("Cookie", ownerCookie);
    expect(ownerProfile.statusCode).toBe(200);
    expect(ownerProfile.body.reputationScore).toBeGreaterThan(0);

    const boostCreate = await request(app.server).post("/api/v1/boosts").set("Cookie", ownerCookie).send({
      listingId,
      amount: 99.9,
      days: 7,
      paymentConfirmed: true
    });

    expect(boostCreate.statusCode).toBe(201);
    expect(boostCreate.body.status).toBe("ACTIVE");
  });
});
