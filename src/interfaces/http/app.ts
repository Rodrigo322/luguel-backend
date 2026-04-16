import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { env } from "../../shared/config/env";
import { registerSecurity } from "./plugins/register-security";
import { registerSwagger } from "./plugins/register-swagger";
import { registerRoutes } from "./routes";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== "test"
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerSecurity(app);
  await registerSwagger(app);
  await registerRoutes(app);

  app.setErrorHandler((error, _request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Request body, params or query is invalid."
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: "InternalServerError",
      message: "An unexpected error occurred."
    });
  });

  return app;
}
