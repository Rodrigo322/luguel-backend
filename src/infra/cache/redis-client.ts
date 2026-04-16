import Redis from "ioredis";
import { env } from "../../shared/config/env";

const globalForRedis = globalThis as unknown as { redis?: Redis };
let isErrorHandlerAttached = false;

export function getRedisClient(): Redis {
  const redis =
    globalForRedis.redis ??
    new Redis(env.REDIS_URL, {
      connectTimeout: 2_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true
    });

  if (!isErrorHandlerAttached) {
    redis.on("error", () => {
      // Redis outages should not crash the API process.
    });
    isErrorHandlerAttached = true;
  }

  if (env.NODE_ENV !== "production") {
    globalForRedis.redis = redis;
  }

  return redis;
}
