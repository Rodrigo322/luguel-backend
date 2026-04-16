import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { requestRental } from "../../../application/rentals/request-rental";
import { updateRentalStatusFlow } from "../../../application/rentals/update-rental-status";
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

export async function rentalsRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "POST",
    url: "/rentals",
    schema: {
      tags: ["Rentals"],
      summary: "Solicita locação",
      description: "Cria solicitação de locação para anúncio ativo.",
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
        const rental = requestRental({
          tenantId: context.user.id,
          listingId: request.body.listingId,
          startDate: new Date(request.body.startDate),
          endDate: new Date(request.body.endDate)
        });

        return reply.status(201).send({
          ...rental,
          startDate: rental.startDate.toISOString(),
          endDate: rental.endDate.toISOString(),
          createdAt: rental.createdAt.toISOString(),
          updatedAt: rental.updatedAt.toISOString()
        });
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
      summary: "Atualiza status de locação",
      description: "Atualiza status de locação por locador dono do anúncio ou admin.",
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
        const updated = updateRentalStatusFlow({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          rentalId: request.params.rentalId,
          status: request.body.status
        });

        return reply.status(200).send({
          ...updated,
          startDate: updated.startDate.toISOString(),
          endDate: updated.endDate.toISOString(),
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString()
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });
}
