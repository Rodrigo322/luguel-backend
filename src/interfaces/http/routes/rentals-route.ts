import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getRentalDetails } from "../../../application/rentals/get-rental-details";
import { listRentals } from "../../../application/rentals/list-rentals";
import { requestRental } from "../../../application/rentals/request-rental";
import { updateRentalStatusFlow } from "../../../application/rentals/update-rental-status";
import { writeAuditLog } from "../../../infra/logging/audit-logger";
import type { AppAuth } from "../auth/create-auth";
import { requireAuth, requireRoles } from "../auth/guards";
import { handleDomainError } from "../errors/handle-domain-error";

const rentalSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  tenantId: z.string(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  totalPrice: z.number(),
  status: z.enum(["REQUESTED", "APPROVED", "ACTIVE", "COMPLETED", "CANCELED", "DISPUTED"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const requestRentalBodySchema = z.object({
  listingId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
});

const updateRentalStatusBodySchema = z.object({
  status: z.enum(["APPROVED", "ACTIVE", "COMPLETED", "CANCELED"])
});

function serializeRental(rental: {
  id: string;
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: "REQUESTED" | "APPROVED" | "ACTIVE" | "COMPLETED" | "CANCELED" | "DISPUTED";
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...rental,
    startDate: rental.startDate.toISOString(),
    endDate: rental.endDate.toISOString(),
    createdAt: rental.createdAt.toISOString(),
    updatedAt: rental.updatedAt.toISOString()
  };
}

export async function rentalsRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "POST",
    url: "/rentals",
    schema: {
      tags: ["Rentals"],
      summary: "Solicita locacao",
      description: "Cria solicitacao de locacao para anuncio ativo.",
      body: requestRentalBodySchema,
      response: {
        201: rentalSchema,
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

      if (!requireRoles(context, ["LOCATARIO", "ADMIN"], reply)) {
        return;
      }

      try {
        const rental = await requestRental({
          tenantId: context.user.id,
          listingId: request.body.listingId,
          startDate: new Date(request.body.startDate),
          endDate: new Date(request.body.endDate)
        });

        writeAuditLog(request.log, {
          action: "RENTAL_REQUESTED",
          actorId: context.user.id,
          entityType: "rental",
          entityId: rental.id,
          metadata: {
            listingId: rental.listingId,
            status: rental.status
          }
        });

        return reply.status(201).send(serializeRental(rental));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "GET",
    url: "/rentals",
    schema: {
      tags: ["Rentals"],
      summary: "Lista locacoes",
      description: "Lista locacoes do usuario autenticado (admin recebe todas).",
      response: {
        200: z.object({
          rentals: z.array(rentalSchema)
        }),
        401: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      const rentals = (await listRentals({
        requesterId: context.user.id,
        requesterRole: context.user.role
      })).map(serializeRental);

      writeAuditLog(request.log, {
        action: "RENTAL_LIST_FETCHED",
        actorId: context.user.id,
        entityType: "rental",
        entityId: "collection",
        metadata: {
          count: rentals.length
        }
      });

      return reply.status(200).send({ rentals });
    }
  });

  typedApp.route({
    method: "GET",
    url: "/rentals/:rentalId",
    schema: {
      tags: ["Rentals"],
      summary: "Consulta locacao",
      description: "Retorna detalhes de locacao com controle de acesso por participante ou admin.",
      params: z.object({
        rentalId: z.string().uuid()
      }),
      response: {
        200: rentalSchema,
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

      try {
        const rental = await getRentalDetails({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          rentalId: request.params.rentalId
        });

        writeAuditLog(request.log, {
          action: "RENTAL_FETCHED",
          actorId: context.user.id,
          entityType: "rental",
          entityId: rental.id
        });

        return reply.status(200).send(serializeRental(rental));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "PATCH",
    url: "/rentals/:rentalId/status",
    schema: {
      tags: ["Rentals"],
      summary: "Atualiza status de locacao",
      description: "Atualiza status de locacao por locador dono do anuncio ou admin.",
      params: z.object({
        rentalId: z.string().uuid()
      }),
      body: updateRentalStatusBodySchema,
      response: {
        200: rentalSchema,
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

      try {
        const updated = await updateRentalStatusFlow({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          rentalId: request.params.rentalId,
          status: request.body.status
        });

        writeAuditLog(request.log, {
          action: "RENTAL_STATUS_UPDATED",
          actorId: context.user.id,
          entityType: "rental",
          entityId: updated.id,
          metadata: {
            status: updated.status
          }
        });

        return reply.status(200).send(serializeRental(updated));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });
}
