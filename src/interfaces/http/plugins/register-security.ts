import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    global: true
  });

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
    errorResponseBuilder: (_request, context) => {
      return {
        statusCode: 429,
        error: "Too Many Requests",
        message: `Rate limit exceeded. Retry in ${context.after}.`
      };
    }
  });
}
