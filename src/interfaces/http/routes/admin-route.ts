import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { listCriticalReports } from "../../../application/admin/list-critical-reports";
import { suspendCriticalListing } from "../../../application/admin/suspend-critical-listing";
import type { AppAuth } from "../auth/create-auth";
import { requireAuth, requireRoles } from "../auth/guards";
import { handleDomainError } from "../errors/handle-domain-error";

const reportSchema = z.object({
  id: z.string(),
  reporterId: z.string(),
  listingId: z.string().optional(),
  rentalId: z.string().optional(),
  reason: z.string(),
  details: z.string().optional(),
  status: z.enum(["OPEN", "TRIAGED", "RESOLVED", "REJECTED"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const listingSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  dailyPrice: z.number(),
  status: z.enum(["ACTIVE", "FLAGGED", "SUSPENDED", "ARCHIVED"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export async function adminRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "GET",
    url: "/admin/reports/critical",
    schema: {
      tags: ["Admin"],
      summary: "Lista denúncias críticas",
      description: "Lista denúncias em estado crítico para triagem administrativa.",
      response: {
        200: z.object({
          reports: z.array(reportSchema)
        }),
        401: z.object({ error: z.string(), message: z.string() }),
        403: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      if (!requireRoles(context, ["ADMIN"], reply)) {
        return;
      }

      const reports = (await listCriticalReports()).map((report) => ({
        ...report,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString()
      }));

      return reply.status(200).send({ reports });
    }
  });

  typedApp.route({
    method: "POST",
    url: "/admin/listings/:listingId/suspend",
    schema: {
      tags: ["Admin"],
      summary: "Suspende anúncio crítico",
      description: "Permite ação administrativa somente para casos críticos.",
      params: z.object({
        listingId: z.string().uuid()
      }),
      body: z.object({
        reason: z.string().min(10).max(500)
      }),
      response: {
        200: listingSchema,
        400: z.object({ error: z.string(), message: z.string() }),
        401: z.object({ error: z.string(), message: z.string() }),
        403: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      if (!requireRoles(context, ["ADMIN"], reply)) {
        return;
      }

      try {
        const suspendedListing = await suspendCriticalListing({
          adminId: context.user.id,
          listingId: request.params.listingId,
          reason: request.body.reason
        });

        return reply.status(200).send({
          ...suspendedListing,
          createdAt: suspendedListing.createdAt.toISOString(),
          updatedAt: suspendedListing.updatedAt.toISOString()
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });
}
