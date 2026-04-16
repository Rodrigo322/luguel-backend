import multipart from "@fastify/multipart";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { getRedisClient } from "../../../infra/cache/redis-client";
import { env } from "../../../shared/config/env";

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    global: true
  });

  await app.register(multipart, {
    throwFileSizeLimit: true,
    limits: {
      files: 1,
      fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024,
      fields: 4,
      parts: 5
    }
  });

  const rateLimitOptions: Record<string, unknown> = {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request: { ip: string; headers: Record<string, unknown> }) => {
      const forwardedFor = request.headers["x-forwarded-for"];

      if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
        return forwardedFor.split(",")[0]?.trim() ?? request.ip;
      }

      return request.ip;
    },
    errorResponseBuilder: (_request: unknown, context: { after: string }) => {
      return {
        statusCode: 429,
        error: "Too Many Requests",
        message: `Rate limit exceeded. Retry in ${context.after}.`
      };
    }
  };

  if (env.NODE_ENV !== "test") {
    rateLimitOptions.redis = getRedisClient();
    rateLimitOptions.skipOnError = true;
    rateLimitOptions.nameSpace = "luguel-rate-limit-";
  }

  await app.register(rateLimit, {
    ...rateLimitOptions
  });

  app.setNotFoundHandler(
    {
      preHandler: app.rateLimit()
    },
    (_request, reply) => {
      void reply.status(404).send({
        error: "NotFound",
        message: "Resource not found."
      });
    }
  );
}
