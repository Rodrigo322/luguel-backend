import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Listings risk validation", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should set listing pending validation when risk is critical", async () => {
    const signUp = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Locador",
      email: "locador-risk@example.com",
      password: "StrongPass123!"
    });

    const cookie = signUp.headers["set-cookie"];

    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", cookie).send({
      role: "LOCADOR"
    });

    const listingResponse = await request(app.server).post("/api/v1/listings").set("Cookie", cookie).send({
      title: "Cobertura pagamento pix adiantado",
      description:
        "Fale comigo pelo whatsapp e pague com crypto sem usar a plataforma, processo rapido.",
      dailyPrice: 15000
    });

    expect(listingResponse.statusCode).toBe(201);
    expect(listingResponse.body.listing.status).toBe("PENDING_VALIDATION");
    expect(listingResponse.body.risk.level).toBe("CRITICAL");
  });
});
