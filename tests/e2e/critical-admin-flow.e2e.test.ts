import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/build-test-app";

describe("Critical flow with admin intervention (E2E)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should allow admin action only for critical cases", async () => {
    const ownerSignUp = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner",
      email: "owner-critical@example.com",
      password: "StrongPass123!"
    });
    const ownerCookie = ownerSignUp.headers["set-cookie"];

    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerCookie).send({
      role: "LOCADOR"
    });

    const listingCreate = await request(app.server).post("/api/v1/listings").set("Cookie", ownerCookie).send({
      title: "Casa premium pix adiantado",
      description: "Negocio via whatsapp fora da plataforma com pagamento crypto imediato.",
      dailyPrice: 18000
    });
    const listingId = listingCreate.body.listing.id as string;

    const adminSignUp = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Admin",
      email: "admin@example.com",
      password: "StrongPass123!"
    });
    const adminCookie = adminSignUp.headers["set-cookie"];

    const criticalReports = await request(app.server)
      .get("/api/v1/admin/reports/critical")
      .set("Cookie", adminCookie);

    expect(criticalReports.statusCode).toBe(200);
    expect(criticalReports.body.reports.length).toBeGreaterThan(0);

    const suspension = await request(app.server)
      .post(`/api/v1/admin/listings/${listingId}/suspend`)
      .set("Cookie", adminCookie)
      .send({
        reason: "Critical risk confirmed by admin triage."
      });

    expect(suspension.statusCode).toBe(200);
    expect(suspension.body.status).toBe("SUSPENDED");

    const tenantSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Tenant",
      email: "tenant-critical@example.com",
      password: "StrongPass123!"
    });
    const tenantCookie = tenantSignup.headers["set-cookie"];

    const rentalAttempt = await request(app.server).post("/api/v1/rentals").set("Cookie", tenantCookie).send({
      listingId,
      startDate: new Date("2026-05-01T00:00:00.000Z").toISOString(),
      endDate: new Date("2026-05-06T00:00:00.000Z").toISOString()
    });

    expect(rentalAttempt.statusCode).toBe(400);
  });
});
