import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/build-test-app";

describe("Health endpoint (E2E)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return status ok", async () => {
    const response = await request(app.server).get("/api/v1/health");

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "luguel-backend"
    });
    expect(typeof response.body.timestamp).toBe("string");
  });
});
