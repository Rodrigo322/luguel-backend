import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Swagger docs", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should expose OpenAPI JSON with domain and moderation routes", async () => {
    const response = await request(app.server).get("/docs/json");

    expect(response.statusCode).toBe(200);
    expect(response.body.info.title).toBe("Luguel Backend API");
    expect(response.body.paths["/api/v1/reports"]).toBeDefined();
    expect(response.body.paths["/api/v1/reports/attachments"]).toBeDefined();
    expect(response.body.paths["/api/v1/boosts"]).toBeDefined();
    expect(response.body.paths["/api/v1/auth/password/forgot"]).toBeDefined();
    expect(response.body.paths["/api/v1/auth/password/reset"]).toBeDefined();
    expect(response.body.paths["/api/v1/users"]).toBeDefined();
    expect(response.body.paths["/api/v1/listings/{listingId}"]).toBeDefined();
    expect(response.body.paths["/api/v1/admin/users/{userId}/ban"]).toBeDefined();
  });
});
