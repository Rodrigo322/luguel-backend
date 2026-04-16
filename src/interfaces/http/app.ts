import { toNodeHandler } from "better-auth/node";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { resetInMemoryStore } from "../../infra/persistence/in-memory-store";
import { env } from "../../shared/config/env";
import { createAuth } from "./auth/create-auth";
import { registerSecurity } from "./plugins/register-security";
import { registerSwagger } from "./plugins/register-swagger";
import { registerRoutes } from "./routes";

export async function buildApp(): Promise<FastifyInstance> {
  await resetInMemoryStore();

  const app = Fastify({
    logger: env.NODE_ENV !== "test"
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerSecurity(app);
  await registerSwagger(app);

  const auth = createAuth();
  const authNodeHandler = toNodeHandler(auth);

  app.all("/api/auth/*", async (request, reply) => {
    reply.hijack();
    await authNodeHandler(request.raw, reply.raw);
  });

  await registerRoutes(app, auth);

  app.setErrorHandler((error, _request, reply) => {
    const fastifyError = error as FastifyError & { validation?: unknown };

    if (fastifyError.validation) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Request body, params or query is invalid."
      });
    }

    app.log.error(error as Error);
    return reply.status(500).send({
      error: "InternalServerError",
      message: "An unexpected error occurred."
    });
  });

  return app;
}
