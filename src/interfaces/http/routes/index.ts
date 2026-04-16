import type { FastifyInstance } from "fastify";
import type { AppAuth } from "../auth/create-auth";
import { authRoute } from "./auth-route";
import { healthRoute } from "./health-route";
import { usersRoute } from "./users-route";

export async function registerRoutes(app: FastifyInstance, auth: AppAuth): Promise<void> {
  await app.register((scopedApp) => authRoute(scopedApp, auth), { prefix: "/api/v1" });
  await app.register((scopedApp) => usersRoute(scopedApp, auth), { prefix: "/api/v1" });
  await app.register(healthRoute, { prefix: "/api/v1" });
}
