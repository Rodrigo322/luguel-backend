import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Rate limit", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 429 when limit is exceeded", async () => {
    let lastResponseStatus = 0;

    for (let index = 0; index < 101; index += 1) {
      const response = await request(app.server)
        .get("/api/v1/health")
        .set("x-forwarded-for", "198.51.100.10");
      lastResponseStatus = response.statusCode;
    }

    expect(lastResponseStatus).toBe(429);
  });
});
