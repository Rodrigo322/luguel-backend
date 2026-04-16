import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createBoost } from "../../../application/boost/create-boost";
import type { AppAuth } from "../auth/create-auth";
import { requireAuth, requireRoles } from "../auth/guards";
import { handleDomainError } from "../errors/handle-domain-error";

const createBoostBodySchema = z.object({
  listingId: z.string().uuid(),
  amount: z.number().positive(),
  days: z.number().int().min(1).max(30),
  paymentConfirmed: z.boolean()
});

const boostSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  status: z.enum(["PENDING", "PAID", "ACTIVE", "EXPIRED", "CANCELED"]),
  amount: z.number(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export async function boostRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "POST",
    url: "/boosts",
    schema: {
      tags: ["Boost"],
      summary: "Ativa impulsionamento",
      description: "Ativa impulsionamento pago para anúncio elegível.",
      body: createBoostBodySchema,
      response: {
        201: boostSchema,
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

      if (!requireRoles(context, ["LOCADOR", "ADMIN"], reply)) {
        return;
      }

      try {
        const boost = await createBoost({
          requesterId: context.user.id,
          listingId: request.body.listingId,
          amount: request.body.amount,
          days: request.body.days,
          paymentConfirmed: request.body.paymentConfirmed
        });

        return reply.status(201).send({
          ...boost,
          startsAt: boost.startsAt.toISOString(),
          endsAt: boost.endsAt.toISOString(),
          createdAt: boost.createdAt.toISOString(),
          updatedAt: boost.updatedAt.toISOString()
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });
}
