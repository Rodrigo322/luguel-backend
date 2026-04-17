import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Listings search and availability", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should support smart search filters without breaking existing listing flow", async () => {
    const ownerOneSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner One",
      email: "owner-one-search@example.com",
      password: "StrongPass123!"
    });
    const ownerOneCookie = ownerOneSignup.headers["set-cookie"];
    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerOneCookie).send({ role: "LOCADOR" });

    const ownerTwoSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner Two",
      email: "owner-two-search@example.com",
      password: "StrongPass123!"
    });
    const ownerTwoCookie = ownerTwoSignup.headers["set-cookie"];
    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerTwoCookie).send({ role: "LOCADOR" });

    const listingOne = await request(app.server).post("/api/v1/listings").set("Cookie", ownerOneCookie).send({
      title: "Furadeira Profissional",
      description: "Furadeira em otimo estado para servicos residenciais e comerciais.",
      category: "Ferramentas",
      city: "Sao Paulo",
      region: "SP - Zona Sul",
      dailyPrice: 120,
      deliveryMode: "PICKUP",
      bookingMode: "IMMEDIATE"
    });
    expect(listingOne.statusCode).toBe(201);

    const listingTwo = await request(app.server).post("/api/v1/listings").set("Cookie", ownerTwoCookie).send({
      title: "Projetor 4K",
      description: "Projetor premium para eventos, reunioes corporativas e cinema em casa.",
      category: "Eletronicos",
      city: "Campinas",
      region: "SP - Interior",
      dailyPrice: 420,
      deliveryMode: "DELIVERY",
      bookingMode: "SCHEDULED"
    });
    expect(listingTwo.statusCode).toBe(201);

    const listingOneId = listingOne.body.listing.id as string;
    const listingTwoId = listingTwo.body.listing.id as string;

    const setAvailabilityOne = await request(app.server)
      .put(`/api/v1/listings/${listingOneId}/availability`)
      .set("Cookie", ownerOneCookie)
      .send({
        slots: [
          {
            date: "2026-08-10T00:00:00.000Z",
            status: "FREE",
            pickupTime: "09:00",
            returnTime: "18:00"
          },
          {
            date: "2026-08-11T00:00:00.000Z",
            status: "FREE",
            pickupTime: "09:00",
            returnTime: "18:00"
          }
        ]
      });
    expect(setAvailabilityOne.statusCode).toBe(200);
    expect(setAvailabilityOne.body.slots).toHaveLength(2);

    const setAvailabilityTwo = await request(app.server)
      .put(`/api/v1/listings/${listingTwoId}/availability`)
      .set("Cookie", ownerTwoCookie)
      .send({
        slots: [
          {
            date: "2026-08-10T00:00:00.000Z",
            status: "BLOCKED",
            pickupTime: "10:00",
            returnTime: "16:00"
          },
          {
            date: "2026-08-11T00:00:00.000Z",
            status: "BLOCKED",
            pickupTime: "10:00",
            returnTime: "16:00"
          }
        ]
      });
    expect(setAvailabilityTwo.statusCode).toBe(200);

    const tenantSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Tenant Search",
      email: "tenant-search@example.com",
      password: "StrongPass123!"
    });
    const tenantCookie = tenantSignup.headers["set-cookie"];

    const rentalRequest = await request(app.server).post("/api/v1/rentals").set("Cookie", tenantCookie).send({
      listingId: listingOneId,
      startDate: "2026-08-10T00:00:00.000Z",
      endDate: "2026-08-12T00:00:00.000Z"
    });
    expect(rentalRequest.statusCode).toBe(201);

    const rentalId = rentalRequest.body.id as string;
    await request(app.server)
      .patch(`/api/v1/rentals/${rentalId}/status`)
      .set("Cookie", ownerOneCookie)
      .send({ status: "APPROVED" });
    await request(app.server)
      .patch(`/api/v1/rentals/${rentalId}/status`)
      .set("Cookie", ownerOneCookie)
      .send({ status: "ACTIVE" });
    await request(app.server)
      .patch(`/api/v1/rentals/${rentalId}/status`)
      .set("Cookie", ownerOneCookie)
      .send({ status: "COMPLETED" });

    const review = await request(app.server).post("/api/v1/reviews").set("Cookie", tenantCookie).send({
      listingId: listingOneId,
      rentalId,
      rating: 5,
      comment: "Equipamento excelente."
    });
    expect(review.statusCode).toBe(201);

    const byCategory = await request(app.server).get("/api/v1/listings?category=Ferramentas");
    expect(byCategory.statusCode).toBe(200);
    expect(byCategory.body.listings).toHaveLength(1);
    expect(byCategory.body.listings[0].id).toBe(listingOneId);

    const cityAndPrice = await request(app.server).get(
      "/api/v1/listings?city=Campinas&minPrice=300&deliveryMode=DELIVERY&bookingMode=SCHEDULED"
    );
    expect(cityAndPrice.statusCode).toBe(200);
    expect(cityAndPrice.body.listings).toHaveLength(1);
    expect(cityAndPrice.body.listings[0].id).toBe(listingTwoId);

    const byRating = await request(app.server).get("/api/v1/listings?minRating=4");
    expect(byRating.statusCode).toBe(200);
    expect(byRating.body.listings.some((listing: { id: string }) => listing.id === listingOneId)).toBe(true);

    const byAvailability = await request(app.server).get(
      "/api/v1/listings?availableFrom=2026-08-10T00:00:00.000Z&availableTo=2026-08-12T00:00:00.000Z"
    );
    expect(byAvailability.statusCode).toBe(200);
    expect(byAvailability.body.listings).toHaveLength(1);
    expect(byAvailability.body.listings[0].id).toBe(listingOneId);
  });

  it("should enforce availability ownership and expose listing agenda", async () => {
    const ownerSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner Agenda",
      email: "owner-agenda@example.com",
      password: "StrongPass123!"
    });
    const ownerCookie = ownerSignup.headers["set-cookie"];
    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerCookie).send({ role: "LOCADOR" });

    const outsiderSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Outsider Agenda",
      email: "outsider-agenda@example.com",
      password: "StrongPass123!"
    });
    const outsiderCookie = outsiderSignup.headers["set-cookie"];

    const listing = await request(app.server).post("/api/v1/listings").set("Cookie", ownerCookie).send({
      title: "Camera DSLR",
      description: "Camera DSLR com lente principal para ensaios e conteudo criativo.",
      dailyPrice: 210
    });
    expect(listing.statusCode).toBe(201);
    const listingId = listing.body.listing.id as string;

    const invalidTime = await request(app.server)
      .put(`/api/v1/listings/${listingId}/availability`)
      .set("Cookie", ownerCookie)
      .send({
        slots: [
          {
            date: "2026-09-01T00:00:00.000Z",
            status: "FREE",
            pickupTime: "18:00",
            returnTime: "10:00"
          }
        ]
      });
    expect(invalidTime.statusCode).toBe(400);

    const forbiddenUpdate = await request(app.server)
      .put(`/api/v1/listings/${listingId}/availability`)
      .set("Cookie", outsiderCookie)
      .send({
        slots: [
          {
            date: "2026-09-01T00:00:00.000Z",
            status: "BLOCKED",
            pickupTime: "10:00",
            returnTime: "17:00"
          }
        ]
      });
    expect(forbiddenUpdate.statusCode).toBe(403);

    const setAgenda = await request(app.server)
      .put(`/api/v1/listings/${listingId}/availability`)
      .set("Cookie", ownerCookie)
      .send({
        slots: [
          {
            date: "2026-09-01T00:00:00.000Z",
            status: "FREE",
            pickupTime: "09:00",
            returnTime: "18:00"
          },
          {
            date: "2026-09-02T00:00:00.000Z",
            status: "BLOCKED",
            pickupTime: "09:00",
            returnTime: "18:00"
          }
        ]
      });
    expect(setAgenda.statusCode).toBe(200);
    expect(setAgenda.body.slots).toHaveLength(2);

    const getAgenda = await request(app.server).get(`/api/v1/listings/${listingId}/availability`);
    expect(getAgenda.statusCode).toBe(200);
    expect(getAgenda.body.slots).toHaveLength(2);
    expect(getAgenda.body.slots[0].pickupTime).toBeDefined();
    expect(getAgenda.body.slots[0].returnTime).toBeDefined();
  });
});
