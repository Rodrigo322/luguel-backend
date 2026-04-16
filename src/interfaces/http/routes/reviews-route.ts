import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createReview } from "../../../application/reviews/create-review";
import type { AppAuth } from "../auth/create-auth";
import { requireAuth } from "../auth/guards";
import { handleDomainError } from "../errors/handle-domain-error";

const createReviewBodySchema = z.object({
  listingId: z.string().uuid(),
  rentalId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1200).optional()
});

const reviewSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  rentalId: z.string(),
  reviewerId: z.string(),
  reviewedId: z.string(),
  rating: z.number().int(),
  comment: z.string().optional(),
  createdAt: z.string().datetime()
});

export async function reviewsRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "POST",
    url: "/reviews",
    schema: {
      tags: ["Reviews"],
      summary: "Cria avaliação",
      description: "Registra avaliação e atualiza reputação automaticamente.",
      body: createReviewBodySchema,
      response: {
        201: reviewSchema,
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
        const review = await createReview({
          reviewerId: context.user.id,
          listingId: request.body.listingId,
          rentalId: request.body.rentalId,
          rating: request.body.rating,
          comment: request.body.comment
        });

        return reply.status(201).send({
          ...review,
          createdAt: review.createdAt.toISOString()
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });
}
