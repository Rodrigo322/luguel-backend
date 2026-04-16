import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { archiveListing } from "../../../application/listings/archive-listing";
import { createListing } from "../../../application/listings/create-listing";
import { updateListing } from "../../../application/listings/update-listing";
import { writeAuditLog } from "../../../infra/logging/audit-logger";
import {
  getListingById,
  listListingRecords,
  listListingsByOwner
} from "../../../infra/persistence/in-memory-store";
import type { AppAuth } from "../auth/create-auth";
import { requireAuth } from "../auth/guards";
import { handleDomainError } from "../errors/handle-domain-error";

const listingStatusSchema = z.enum(["ACTIVE", "PENDING_VALIDATION", "FLAGGED", "SUSPENDED", "ARCHIVED"]);

const listingSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  dailyPrice: z.number(),
  status: listingStatusSchema,
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const createListingBodySchema = z.object({
  title: z.string().min(4).max(120),
  description: z.string().min(20).max(2000),
  dailyPrice: z.number().positive()
});

const updateListingBodySchema = z
  .object({
    title: z.string().min(4).max(120).optional(),
    description: z.string().min(20).max(2000).optional(),
    dailyPrice: z.number().positive().optional()
  })
  .refine((body) => body.title !== undefined || body.description !== undefined || body.dailyPrice !== undefined, {
    message: "At least one listing field must be informed"
  });

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

export async function listingsRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "POST",
    url: "/listings",
    schema: {
      tags: ["Listings"],
      summary: "Cria anuncio",
      description: "Cria anuncio e executa validacao automatica de risco.",
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
        const result = await createListing({
          ownerId: context.user.id,
          title: request.body.title,
          description: request.body.description,
          dailyPrice: request.body.dailyPrice
        });

        writeAuditLog(request.log, {
          action: "LISTING_CREATED",
          actorId: context.user.id,
          entityType: "listing",
          entityId: result.listing.id,
          metadata: {
            riskLevel: result.risk.level,
            status: result.listing.status
          }
        });

        return reply.status(201).send({
          listing: serializeListing(result.listing),
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
      summary: "Lista anuncios",
      description: "Retorna lista de anuncios cadastrados.",
      querystring: z.object({
        ownerId: z.string().min(1).optional(),
        status: listingStatusSchema.optional()
      }),
      response: {
        200: z.object({
          listings: z.array(listingSchema)
        })
      }
    },
    handler: async (request, reply) => {
      const ownerId = request.query.ownerId;
      const status = request.query.status;

      const baseListings = ownerId ? await listListingsByOwner(ownerId) : await listListingRecords();
      const filteredListings = status ? baseListings.filter((listing) => listing.status === status) : baseListings;
      const listings = filteredListings.map(serializeListing);

      writeAuditLog(reply.log, {
        action: "LISTING_LIST_FETCHED",
        entityType: "listing",
        entityId: "collection",
        metadata: {
          count: listings.length,
          ownerId,
          status
        }
      });

      return reply.status(200).send({ listings });
    }
  });

  typedApp.route({
    method: "GET",
    url: "/listings/:listingId",
    schema: {
      tags: ["Listings"],
      summary: "Consulta anuncio",
      description: "Retorna detalhes de um anuncio especifico.",
      params: z.object({
        listingId: z.string().uuid()
      }),
      response: {
        200: listingSchema,
        404: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const listing = await getListingById(request.params.listingId);

      if (!listing) {
        return reply.status(404).send({
          error: "ListingNotFound",
          message: "Listing not found."
        });
      }

      writeAuditLog(request.log, {
        action: "LISTING_FETCHED",
        entityType: "listing",
        entityId: listing.id
      });

      return reply.status(200).send(serializeListing(listing));
    }
  });

  typedApp.route({
    method: "PATCH",
    url: "/listings/:listingId",
    schema: {
      tags: ["Listings"],
      summary: "Atualiza anuncio",
      description: "Atualiza anuncio e reprocessa validacao automatica de risco.",
      params: z.object({
        listingId: z.string().uuid()
      }),
      body: updateListingBodySchema,
      response: {
        200: z.object({
          listing: listingSchema,
          risk: z.object({
            score: z.number().int(),
            level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
            reasons: z.array(z.string())
          })
        }),
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

      try {
        const result = await updateListing({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          listingId: request.params.listingId,
          title: request.body.title,
          description: request.body.description,
          dailyPrice: request.body.dailyPrice
        });

        writeAuditLog(request.log, {
          action: "LISTING_UPDATED",
          actorId: context.user.id,
          entityType: "listing",
          entityId: result.listing.id,
          metadata: {
            status: result.listing.status,
            riskLevel: result.risk.level
          }
        });

        return reply.status(200).send({
          listing: serializeListing(result.listing),
          risk: result.risk
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "DELETE",
    url: "/listings/:listingId",
    schema: {
      tags: ["Listings"],
      summary: "Remove anuncio",
      description: "Arquiva anuncio (soft delete) por dono do anuncio ou admin.",
      params: z.object({
        listingId: z.string().uuid()
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

      try {
        const archivedListing = await archiveListing({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          listingId: request.params.listingId
        });

        writeAuditLog(request.log, {
          action: "LISTING_ARCHIVED",
          actorId: context.user.id,
          entityType: "listing",
          entityId: archivedListing.id
        });

        return reply.status(200).send(serializeListing(archivedListing));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });
}
