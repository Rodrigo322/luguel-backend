import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { archiveListing } from "../../../application/listings/archive-listing";
import { createListing } from "../../../application/listings/create-listing";
import {
  getListingAvailability,
  setListingAvailability
} from "../../../application/listings/manage-listing-availability";
import { searchListings } from "../../../application/listings/search-listings";
import { updateListing } from "../../../application/listings/update-listing";
import { writeAuditLog } from "../../../infra/logging/audit-logger";
import { getListingById } from "../../../infra/persistence/in-memory-store";
import type { AppAuth } from "../auth/create-auth";
import { requireAuth } from "../auth/guards";
import { handleDomainError } from "../errors/handle-domain-error";

const listingStatusSchema = z.enum(["ACTIVE", "PENDING_VALIDATION", "FLAGGED", "SUSPENDED", "ARCHIVED"]);
const listingDeliveryModeSchema = z.enum(["PICKUP", "DELIVERY", "BOTH"]);
const listingBookingModeSchema = z.enum(["IMMEDIATE", "SCHEDULED", "BOTH"]);
const listingAvailabilityStatusSchema = z.enum(["FREE", "BLOCKED"]);

const listingSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  dailyPrice: z.number(),
  deliveryMode: listingDeliveryModeSchema,
  bookingMode: listingBookingModeSchema,
  status: listingStatusSchema,
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  averageRating: z.number().min(0).max(5).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const createListingBodySchema = z.object({
  title: z.string().min(4).max(120),
  description: z.string().min(20).max(2000),
  category: z.string().trim().min(2).max(80).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  region: z.string().trim().min(2).max(120).optional(),
  dailyPrice: z.number().positive(),
  deliveryMode: listingDeliveryModeSchema.optional(),
  bookingMode: listingBookingModeSchema.optional()
});

const updateListingBodySchema = z
  .object({
    title: z.string().min(4).max(120).optional(),
    description: z.string().min(20).max(2000).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    city: z.string().trim().min(2).max(80).optional(),
    region: z.string().trim().min(2).max(120).optional(),
    dailyPrice: z.number().positive().optional(),
    deliveryMode: listingDeliveryModeSchema.optional(),
    bookingMode: listingBookingModeSchema.optional()
  })
  .refine(
    (body) =>
      body.title !== undefined ||
      body.description !== undefined ||
      body.category !== undefined ||
      body.city !== undefined ||
      body.region !== undefined ||
      body.dailyPrice !== undefined ||
      body.deliveryMode !== undefined ||
      body.bookingMode !== undefined,
    {
      message: "At least one listing field must be informed"
    }
  );

const listingSearchQuerySchema = z
  .object({
    ownerId: z.string().min(1).optional(),
    status: listingStatusSchema.optional(),
    category: z.string().trim().min(2).max(80).optional(),
    city: z.string().trim().min(2).max(80).optional(),
    region: z.string().trim().min(2).max(120).optional(),
    minPrice: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),
    deliveryMode: z.enum(["PICKUP", "DELIVERY"]).optional(),
    bookingMode: z.enum(["IMMEDIATE", "SCHEDULED"]).optional(),
    minRating: z.coerce.number().min(1).max(5).optional(),
    availableFrom: z.string().datetime().optional(),
    availableTo: z.string().datetime().optional()
  })
  .refine(
    (query) => !(query.minPrice !== undefined && query.maxPrice !== undefined) || query.minPrice <= query.maxPrice,
    {
      message: "minPrice must be less than or equal to maxPrice"
    }
  )
  .refine((query) => Boolean(query.availableFrom) === Boolean(query.availableTo), {
    message: "availableFrom and availableTo must be informed together"
  });

const availabilityQuerySchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
  .refine((query) => Boolean(query.startDate) === Boolean(query.endDate), {
    message: "startDate and endDate must be informed together"
  });

const availabilitySlotSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  date: z.string().datetime(),
  status: listingAvailabilityStatusSchema,
  pickupTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  returnTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const availabilityBodySchema = z.object({
  slots: z.array(
    z.object({
      date: z.string().datetime(),
      status: listingAvailabilityStatusSchema,
      pickupTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
      returnTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    })
  )
});

function serializeListing(listing: {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category?: string;
  city?: string;
  region?: string;
  dailyPrice: number;
  deliveryMode: "PICKUP" | "DELIVERY" | "BOTH";
  bookingMode: "IMMEDIATE" | "SCHEDULED" | "BOTH";
  status: "ACTIVE" | "PENDING_VALIDATION" | "FLAGGED" | "SUSPENDED" | "ARCHIVED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  averageRating?: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: listing.id,
    ownerId: listing.ownerId,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    city: listing.city,
    region: listing.region,
    dailyPrice: listing.dailyPrice,
    deliveryMode: listing.deliveryMode,
    bookingMode: listing.bookingMode,
    status: listing.status,
    riskLevel: listing.riskLevel,
    averageRating: listing.averageRating,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString()
  };
}

function serializeAvailabilitySlot(slot: {
  id: string;
  listingId: string;
  date: Date;
  status: "FREE" | "BLOCKED";
  pickupTime?: string;
  returnTime?: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: slot.id,
    listingId: slot.listingId,
    date: slot.date.toISOString(),
    status: slot.status,
    pickupTime: slot.pickupTime,
    returnTime: slot.returnTime,
    createdAt: slot.createdAt.toISOString(),
    updatedAt: slot.updatedAt.toISOString()
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
          category: request.body.category,
          city: request.body.city,
          region: request.body.region,
          dailyPrice: request.body.dailyPrice,
          deliveryMode: request.body.deliveryMode,
          bookingMode: request.body.bookingMode
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
      description: "Retorna lista de anuncios cadastrados com busca inteligente.",
      querystring: listingSearchQuerySchema,
      response: {
        200: z.object({
          listings: z.array(listingSchema)
        }),
        400: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      try {
        const listings = (
          await searchListings({
            ownerId: request.query.ownerId,
            status: request.query.status,
            category: request.query.category,
            city: request.query.city,
            region: request.query.region,
            minPrice: request.query.minPrice,
            maxPrice: request.query.maxPrice,
            deliveryMode: request.query.deliveryMode,
            bookingMode: request.query.bookingMode,
            minRating: request.query.minRating,
            availableFrom: request.query.availableFrom ? new Date(request.query.availableFrom) : undefined,
            availableTo: request.query.availableTo ? new Date(request.query.availableTo) : undefined
          })
        ).map(serializeListing);

        writeAuditLog(reply.log, {
          action: "LISTING_LIST_FETCHED",
          entityType: "listing",
          entityId: "collection",
          metadata: {
            count: listings.length,
            ownerId: request.query.ownerId,
            status: request.query.status,
            category: request.query.category,
            city: request.query.city,
            region: request.query.region,
            minPrice: request.query.minPrice,
            maxPrice: request.query.maxPrice,
            deliveryMode: request.query.deliveryMode,
            bookingMode: request.query.bookingMode,
            minRating: request.query.minRating,
            availableFrom: request.query.availableFrom,
            availableTo: request.query.availableTo
          }
        });

        return reply.status(200).send({ listings });
      } catch (error) {
        handleDomainError(reply, error);
      }
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
    method: "GET",
    url: "/listings/:listingId/availability",
    schema: {
      tags: ["Listings"],
      summary: "Consulta agenda de disponibilidade",
      description: "Retorna datas livres/bloqueadas e horarios de retirada/devolucao do anuncio.",
      params: z.object({
        listingId: z.string().uuid()
      }),
      querystring: availabilityQuerySchema,
      response: {
        200: z.object({
          slots: z.array(availabilitySlotSchema)
        }),
        400: z.object({ error: z.string(), message: z.string() }),
        404: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      try {
        const slots = await getListingAvailability({
          listingId: request.params.listingId,
          startDate: request.query.startDate ? new Date(request.query.startDate) : undefined,
          endDate: request.query.endDate ? new Date(request.query.endDate) : undefined
        });

        return reply.status(200).send({
          slots: slots.map(serializeAvailabilitySlot)
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
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
          category: request.body.category,
          city: request.body.city,
          region: request.body.region,
          dailyPrice: request.body.dailyPrice,
          deliveryMode: request.body.deliveryMode,
          bookingMode: request.body.bookingMode
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
    method: "PUT",
    url: "/listings/:listingId/availability",
    schema: {
      tags: ["Listings"],
      summary: "Atualiza agenda de disponibilidade",
      description: "Permite ao dono do anuncio definir datas livres/bloqueadas e horarios de retirada/devolucao.",
      params: z.object({
        listingId: z.string().uuid()
      }),
      body: availabilityBodySchema,
      response: {
        200: z.object({
          slots: z.array(availabilitySlotSchema)
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
        const slots = await setListingAvailability({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          listingId: request.params.listingId,
          slots: request.body.slots.map((slot) => ({
            date: new Date(slot.date),
            status: slot.status,
            pickupTime: slot.pickupTime,
            returnTime: slot.returnTime
          }))
        });

        writeAuditLog(request.log, {
          action: "LISTING_AVAILABILITY_UPDATED",
          actorId: context.user.id,
          entityType: "listing",
          entityId: request.params.listingId,
          metadata: {
            slots: slots.length
          }
        });

        return reply.status(200).send({
          slots: slots.map(serializeAvailabilitySlot)
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
