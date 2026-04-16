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

  it("should expose OpenAPI JSON with upload and domain routes", async () => {
    const response = await request(app.server).get("/docs/json");

    expect(response.statusCode).toBe(200);
    expect(response.body.info.title).toBe("Luguel Backend API");
    expect(response.body.paths["/api/v1/reports"]).toBeDefined();
    expect(response.body.paths["/api/v1/reports/attachments"]).toBeDefined();
    expect(response.body.paths["/api/v1/boosts"]).toBeDefined();
  });
});
