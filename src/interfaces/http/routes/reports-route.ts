import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createReport } from "../../../application/reports/create-report";
import type { AppAuth } from "../auth/create-auth";
import { requireAuth } from "../auth/guards";
import { handleDomainError } from "../errors/handle-domain-error";

const createReportBodySchema = z
  .object({
    listingId: z.string().uuid().optional(),
    rentalId: z.string().uuid().optional(),
    reason: z.string().min(8).max(300),
    details: z.string().max(2000).optional()
  })
  .refine((body) => body.listingId || body.rentalId, {
    message: "listingId or rentalId must be informed",
    path: ["listingId"]
  });

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

export async function reportsRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "POST",
    url: "/reports",
    schema: {
      tags: ["Reports"],
      summary: "Cria denúncia",
      description: "Registra denúncia com classificação automática de severidade.",
      body: createReportBodySchema,
      response: {
        201: reportSchema,
        400: z.object({ error: z.string(), message: z.string() }),
        401: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      try {
        const report = createReport({
          reporterId: context.user.id,
          listingId: request.body.listingId,
          rentalId: request.body.rentalId,
          reason: request.body.reason,
          details: request.body.details
        });

        return reply.status(201).send({
          ...report,
          createdAt: report.createdAt.toISOString(),
          updatedAt: report.updatedAt.toISOString()
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });
}
