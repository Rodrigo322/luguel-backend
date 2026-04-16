import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { archiveListingByAdmin } from "../../../application/admin/archive-listing";
import { banUserFlow } from "../../../application/admin/ban-user";
import { listCriticalReports } from "../../../application/admin/list-critical-reports";
import { reviewReport } from "../../../application/admin/review-report";
import { suspendCriticalListing } from "../../../application/admin/suspend-critical-listing";
import { writeAuditLog } from "../../../infra/logging/audit-logger";
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
  status: z.enum(["ACTIVE", "PENDING_VALIDATION", "FLAGGED", "SUSPENDED", "ARCHIVED"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["LOCADOR", "LOCATARIO", "ADMIN"]),
  isBanned: z.boolean(),
  bannedAt: z.string().datetime().optional(),
  reputationScore: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

function serializeReport(report: {
  id: string;
  reporterId: string;
  listingId?: string;
  rentalId?: string;
  reason: string;
  details?: string;
  status: "OPEN" | "TRIAGED" | "RESOLVED" | "REJECTED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...report,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString()
  };
}

function serializeListing(listing: {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  dailyPrice: number;
  status: "ACTIVE" | "PENDING_VALIDATION" | "FLAGGED" | "SUSPENDED" | "ARCHIVED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...listing,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString()
  };
}

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  role: "LOCADOR" | "LOCATARIO" | "ADMIN";
  isBanned: boolean;
  bannedAt?: Date;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...user,
    bannedAt: user.bannedAt?.toISOString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export async function adminRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "GET",
    url: "/admin/reports/critical",
    schema: {
      tags: ["Admin"],
      summary: "Lista denuncias criticas",
      description: "Lista denuncias em estado critico para triagem administrativa.",
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

      const reports = (await listCriticalReports()).map(serializeReport);

      writeAuditLog(request.log, {
        action: "ADMIN_CRITICAL_REPORTS_FETCHED",
        actorId: context.user.id,
        entityType: "report",
        entityId: "critical-open",
        metadata: {
          count: reports.length
        }
      });

      return reply.status(200).send({ reports });
    }
  });

  typedApp.route({
    method: "PATCH",
    url: "/admin/reports/:reportId/status",
    schema: {
      tags: ["Admin"],
      summary: "Revisa denuncia",
      description: "Atualiza status de denuncia por moderacao administrativa.",
      params: z.object({
        reportId: z.string().uuid()
      }),
      body: z.object({
        status: z.enum(["TRIAGED", "RESOLVED", "REJECTED"]),
        reason: z.string().min(8).max(500).optional()
      }),
      response: {
        200: reportSchema,
        400: z.object({ error: z.string(), message: z.string() }),
        401: z.object({ error: z.string(), message: z.string() }),
        403: z.object({ error: z.string(), message: z.string() }),
        404: z.object({ error: z.string(), message: z.string() })
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
        const reviewed = await reviewReport({
          adminId: context.user.id,
          reportId: request.params.reportId,
          status: request.body.status,
          reason: request.body.reason
        });

        writeAuditLog(request.log, {
          action: "ADMIN_REPORT_REVIEWED",
          actorId: context.user.id,
          entityType: "report",
          entityId: reviewed.id,
          metadata: {
            status: reviewed.status
          }
        });

        return reply.status(200).send(serializeReport(reviewed));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "POST",
    url: "/admin/users/:userId/ban",
    schema: {
      tags: ["Admin"],
      summary: "Bane usuario",
      description: "Bane usuario para bloquear novas acoes na plataforma.",
      params: z.object({
        userId: z.string().min(1)
      }),
      body: z.object({
        reason: z.string().min(8).max(500)
      }),
      response: {
        200: userSchema,
        400: z.object({ error: z.string(), message: z.string() }),
        401: z.object({ error: z.string(), message: z.string() }),
        403: z.object({ error: z.string(), message: z.string() }),
        404: z.object({ error: z.string(), message: z.string() })
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
        const bannedUser = await banUserFlow({
          adminId: context.user.id,
          userId: request.params.userId,
          reason: request.body.reason
        });

        writeAuditLog(request.log, {
          action: "ADMIN_USER_BANNED",
          actorId: context.user.id,
          entityType: "user",
          entityId: bannedUser.id,
          metadata: {
            reason: request.body.reason
          }
        });

        return reply.status(200).send(serializeUser(bannedUser));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "POST",
    url: "/admin/listings/:listingId/suspend",
    schema: {
      tags: ["Admin"],
      summary: "Suspende anuncio critico",
      description: "Permite acao administrativa somente para casos criticos.",
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

        writeAuditLog(request.log, {
          action: "ADMIN_LISTING_SUSPENDED",
          actorId: context.user.id,
          entityType: "listing",
          entityId: suspendedListing.id,
          metadata: {
            reason: request.body.reason
          }
        });

        return reply.status(200).send(serializeListing(suspendedListing));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "POST",
    url: "/admin/listings/:listingId/archive",
    schema: {
      tags: ["Admin"],
      summary: "Remove anuncio",
      description: "Arquiva anuncio via moderacao administrativa.",
      params: z.object({
        listingId: z.string().uuid()
      }),
      body: z.object({
        reason: z.string().min(8).max(500)
      }),
      response: {
        200: listingSchema,
        400: z.object({ error: z.string(), message: z.string() }),
        401: z.object({ error: z.string(), message: z.string() }),
        403: z.object({ error: z.string(), message: z.string() }),
        404: z.object({ error: z.string(), message: z.string() })
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
        const archivedListing = await archiveListingByAdmin({
          adminId: context.user.id,
          listingId: request.params.listingId,
          reason: request.body.reason
        });

        writeAuditLog(request.log, {
          action: "ADMIN_LISTING_ARCHIVED",
          actorId: context.user.id,
          entityType: "listing",
          entityId: archivedListing.id,
          metadata: {
            reason: request.body.reason
          }
        });

        return reply.status(200).send(serializeListing(archivedListing));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });
}
