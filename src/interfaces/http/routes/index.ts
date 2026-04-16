import type { FastifyInstance } from "fastify";
import type { AppAuth } from "../auth/create-auth";
import { adminRoute } from "./admin-route";
import { authRoute } from "./auth-route";
import { boostRoute } from "./boost-route";
import { healthRoute } from "./health-route";
import { listingsRoute } from "./listings-route";
import { rentalsRoute } from "./rentals-route";
import { reportsRoute } from "./reports-route";
import { reviewsRoute } from "./reviews-route";
import { usersRoute } from "./users-route";

export async function registerRoutes(app: FastifyInstance, auth: AppAuth): Promise<void> {
  await app.register((scopedApp) => authRoute(scopedApp, auth), { prefix: "/api/v1" });
  await app.register((scopedApp) => usersRoute(scopedApp, auth), { prefix: "/api/v1" });
  await app.register((scopedApp) => listingsRoute(scopedApp, auth), { prefix: "/api/v1" });
  await app.register((scopedApp) => rentalsRoute(scopedApp, auth), { prefix: "/api/v1" });
  await app.register((scopedApp) => reviewsRoute(scopedApp, auth), { prefix: "/api/v1" });
  await app.register((scopedApp) => reportsRoute(scopedApp, auth), { prefix: "/api/v1" });
  await app.register((scopedApp) => adminRoute(scopedApp, auth), { prefix: "/api/v1" });
  await app.register((scopedApp) => boostRoute(scopedApp, auth), { prefix: "/api/v1" });
  await app.register(healthRoute, { prefix: "/api/v1" });
}
