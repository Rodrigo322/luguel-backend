import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Admin metrics", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function getAdminCookie() {
    const signup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Admin Metrics",
      email: "admin@example.com",
      password: "StrongPass123!"
    });

    if (signup.statusCode === 201) {
      return signup.headers["set-cookie"];
    }

    const signin = await request(app.server).post("/api/v1/auth/signin").send({
      email: "admin@example.com",
      password: "StrongPass123!"
    });

    return signin.headers["set-cookie"];
  }

  it("should return consolidated metrics and reflect admin operations", async () => {
    const adminCookie = await getAdminCookie();

    const baseline = await request(app.server).get("/api/v1/admin/metrics").set("Cookie", adminCookie);
    expect(baseline.statusCode).toBe(200);

    const ownerSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner Metrics",
      email: "owner-metrics@example.com",
      password: "StrongPass123!"
    });
    const ownerCookie = ownerSignup.headers["set-cookie"];
    const ownerId = ownerSignup.body.user.id as string;

    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerCookie).send({ role: "LOCADOR" });

    const listingCreate = await request(app.server).post("/api/v1/listings").set("Cookie", ownerCookie).send({
      title: "Item metrica admin",
      description: "Descricao para contabilizacao de metricas administrativas do dashboard.",
      dailyPrice: 230
    });
    const listingId = listingCreate.body.listing.id as string;

    const tenantSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Tenant Metrics",
      email: "tenant-metrics@example.com",
      password: "StrongPass123!"
    });
    const tenantCookie = tenantSignup.headers["set-cookie"];
    const tenantId = tenantSignup.body.user.id as string;

    await request(app.server).post("/api/v1/rentals").set("Cookie", tenantCookie).send({
      listingId,
      startDate: new Date("2026-08-01T00:00:00.000Z").toISOString(),
      endDate: new Date("2026-08-04T00:00:00.000Z").toISOString()
    });

    await request(app.server).post("/api/v1/reports").set("Cookie", tenantCookie).send({
      listingId,
      reason: "Fraude confirmada",
      details: "golpe em andamento"
    });

    await request(app.server).post("/api/v1/boosts").set("Cookie", ownerCookie).send({
      listingId,
      amount: 49.9,
      days: 5,
      paymentConfirmed: true
    });

    await request(app.server)
      .post(`/api/v1/admin/users/${tenantId}/ban`)
      .set("Cookie", adminCookie)
      .send({ reason: "Comportamento reincidente confirmado." });

    const metricsResponse = await request(app.server).get("/api/v1/admin/metrics").set("Cookie", adminCookie);
    expect(metricsResponse.statusCode).toBe(200);

    const metrics = metricsResponse.body as {
      totalUsers: number;
      totalListings: number;
      totalRentals: number;
      totalReports: number;
      criticalReports: number;
      activeBoosts: number;
      bannedUsers: number;
    };

    expect(metrics.totalUsers).toBeGreaterThanOrEqual(baseline.body.totalUsers + 2);
    expect(metrics.totalListings).toBeGreaterThanOrEqual(baseline.body.totalListings + 1);
    expect(metrics.totalRentals).toBeGreaterThanOrEqual(baseline.body.totalRentals + 1);
    expect(metrics.totalReports).toBeGreaterThanOrEqual(baseline.body.totalReports + 1);
    expect(metrics.criticalReports).toBeGreaterThanOrEqual(baseline.body.criticalReports + 1);
    expect(metrics.activeBoosts).toBeGreaterThanOrEqual(baseline.body.activeBoosts + 1);
    expect(metrics.bannedUsers).toBeGreaterThanOrEqual(baseline.body.bannedUsers + 1);

    const ownerProfileByAdmin = await request(app.server).get(`/api/v1/users/${ownerId}`).set("Cookie", adminCookie);
    expect(ownerProfileByAdmin.statusCode).toBe(200);
    expect(ownerProfileByAdmin.body.role).toBe("LOCADOR");
  });
});
