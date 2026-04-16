import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Rentals read access", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should allow owner/tenant access and block unrelated users", async () => {
    const ownerSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner Rentals",
      email: "owner-rentals@example.com",
      password: "StrongPass123!"
    });
    const ownerCookie = ownerSignup.headers["set-cookie"];

    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerCookie).send({ role: "LOCADOR" });

    const listingCreate = await request(app.server).post("/api/v1/listings").set("Cookie", ownerCookie).send({
      title: "Casa praia",
      description: "Imovel com contrato claro para aluguel seguro na plataforma.",
      dailyPrice: 300
    });

    const listingId = listingCreate.body.listing.id as string;

    const tenantSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Tenant Rentals",
      email: "tenant-rentals@example.com",
      password: "StrongPass123!"
    });
    const tenantCookie = tenantSignup.headers["set-cookie"];

    const rentalCreate = await request(app.server).post("/api/v1/rentals").set("Cookie", tenantCookie).send({
      listingId,
      startDate: new Date("2026-08-10T00:00:00.000Z").toISOString(),
      endDate: new Date("2026-08-15T00:00:00.000Z").toISOString()
    });

    expect(rentalCreate.statusCode).toBe(201);

    const rentalId = rentalCreate.body.id as string;

    const tenantRentals = await request(app.server).get("/api/v1/rentals").set("Cookie", tenantCookie);
    expect(tenantRentals.statusCode).toBe(200);
    expect(tenantRentals.body.rentals.some((rental: { id: string }) => rental.id === rentalId)).toBe(true);

    const tenantRentalDetail = await request(app.server).get(`/api/v1/rentals/${rentalId}`).set("Cookie", tenantCookie);
    expect(tenantRentalDetail.statusCode).toBe(200);

    const ownerRentalDetail = await request(app.server).get(`/api/v1/rentals/${rentalId}`).set("Cookie", ownerCookie);
    expect(ownerRentalDetail.statusCode).toBe(200);

    const outsiderSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Outsider Rentals",
      email: "outsider-rentals@example.com",
      password: "StrongPass123!"
    });

    const outsiderCookie = outsiderSignup.headers["set-cookie"];

    const outsiderRentalDetail = await request(app.server)
      .get(`/api/v1/rentals/${rentalId}`)
      .set("Cookie", outsiderCookie);

    expect(outsiderRentalDetail.statusCode).toBe(403);
  });
});
