import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Listings management", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should update and archive listings with ownership controls", async () => {
    const ownerSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner Listings",
      email: "owner-listings@example.com",
      password: "StrongPass123!"
    });

    const ownerCookie = ownerSignup.headers["set-cookie"];
    const ownerId = ownerSignup.body.user.id as string;

    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerCookie).send({ role: "LOCADOR" });

    const listingCreate = await request(app.server).post("/api/v1/listings").set("Cookie", ownerCookie).send({
      title: "Apartamento central",
      description: "Anuncio padrao com regras claras e pagamento pela plataforma.",
      dailyPrice: 180
    });

    expect(listingCreate.statusCode).toBe(201);
    expect(listingCreate.body.listing.status).toBe("ACTIVE");

    const listingId = listingCreate.body.listing.id as string;

    const updateListing = await request(app.server)
      .patch(`/api/v1/listings/${listingId}`)
      .set("Cookie", ownerCookie)
      .send({
        dailyPrice: 14000,
        description: "Pagamento adiantado via pix e contato por whatsapp fora da plataforma com crypto."
      });

    expect(updateListing.statusCode).toBe(200);
    expect(updateListing.body.listing.status).toBe("PENDING_VALIDATION");
    expect(updateListing.body.risk.level).toBe("CRITICAL");

    const outsiderSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Outsider",
      email: "outsider-listings@example.com",
      password: "StrongPass123!"
    });

    const outsiderCookie = outsiderSignup.headers["set-cookie"];

    const unauthorizedUpdate = await request(app.server)
      .patch(`/api/v1/listings/${listingId}`)
      .set("Cookie", outsiderCookie)
      .send({ title: "Tentativa indevida" });

    expect(unauthorizedUpdate.statusCode).toBe(403);

    const filteredList = await request(app.server)
      .get(`/api/v1/listings?ownerId=${ownerId}&status=PENDING_VALIDATION`)
      .set("Cookie", ownerCookie);

    expect(filteredList.statusCode).toBe(200);
    expect(filteredList.body.listings).toHaveLength(1);

    const archiveListing = await request(app.server)
      .delete(`/api/v1/listings/${listingId}`)
      .set("Cookie", ownerCookie);

    expect(archiveListing.statusCode).toBe(200);
    expect(archiveListing.body.status).toBe("ARCHIVED");
  });
});
