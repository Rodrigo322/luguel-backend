import type { FastifyInstance } from "fastify";
import { healthRoute } from "./health-route";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoute, { prefix: "/api/v1" });
}
