import { describe, expect, it } from "vitest";
import { getRedisClient } from "../../../../src/infra/cache/redis-client";

describe("getRedisClient", () => {
  it("should return a singleton redis client instance", () => {
    const first = getRedisClient();
    const second = getRedisClient();

    expect(first).toBe(second);
  });
});
