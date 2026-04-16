import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getHealthStatus } from "../../../application/health/get-health-status";

const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.string().datetime()
});

export async function healthRoute(app: FastifyInstance): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/health",
    schema: {
      tags: ["System"],
      summary: "Verifica saúde da API",
      description: "Retorna o status operacional do serviço backend.",
      response: {
        200: healthResponseSchema
      }
    },
    handler: async () => {
      return getHealthStatus();
    }
  });
}
