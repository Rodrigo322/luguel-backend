import Redis from "ioredis";
import { env } from "../../shared/config/env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
