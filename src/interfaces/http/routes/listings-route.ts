import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { createListing } from "../../../application/listings/create-listing";
import { getListingById, listListingRecords } from "../../../infra/persistence/in-memory-store";
import type { AppAuth } from "../auth/create-auth";
import { requireAuth } from "../auth/guards";
import { handleDomainError } from "../errors/handle-domain-error";

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

const createListingBodySchema = z.object({
  title: z.string().min(4).max(120),
  description: z.string().min(20).max(2000),
  dailyPrice: z.number().positive()
});

export async function listingsRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "POST",
    url: "/listings",
    schema: {
      tags: ["Listings"],
      summary: "Cria anúncio",
      description: "Cria anúncio e executa validação automática de risco.",
      body: createListingBodySchema,
      response: {
        201: z.object({
          listing: listingSchema,
          risk: z.object({
            score: z.number().int(),
            level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
            reasons: z.array(z.string())
          })
        }),
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
        const result = createListing({
          ownerId: context.user.id,
          title: request.body.title,
          description: request.body.description,
          dailyPrice: request.body.dailyPrice
        });

        return reply.status(201).send({
          listing: {
            ...result.listing,
            createdAt: result.listing.createdAt.toISOString(),
            updatedAt: result.listing.updatedAt.toISOString()
          },
          risk: result.risk
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "GET",
    url: "/listings",
    schema: {
      tags: ["Listings"],
      summary: "Lista anúncios",
      description: "Retorna lista de anúncios cadastrados.",
      response: {
        200: z.object({
          listings: z.array(listingSchema)
        })
      }
    },
    handler: async (_request, reply) => {
      const listings = listListingRecords().map((listing) => ({
        ...listing,
        createdAt: listing.createdAt.toISOString(),
        updatedAt: listing.updatedAt.toISOString()
      }));

      return reply.status(200).send({ listings });
    }
  });

  typedApp.route({
    method: "GET",
    url: "/listings/:listingId",
    schema: {
      tags: ["Listings"],
      summary: "Consulta anúncio",
      description: "Retorna detalhes de um anúncio específico.",
      params: z.object({
        listingId: z.string().uuid()
      }),
      response: {
        200: listingSchema,
        404: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const listing = getListingById(request.params.listingId);

      if (!listing) {
        return reply.status(404).send({
          error: "ListingNotFound",
          message: "Listing not found."
        });
      }

      return reply.status(200).send({
        ...listing,
        createdAt: listing.createdAt.toISOString(),
        updatedAt: listing.updatedAt.toISOString()
      });
    }
  });
}
