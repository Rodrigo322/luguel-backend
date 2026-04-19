import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { getRentalDetails } from "../../../application/rentals/get-rental-details";
import { listRentals } from "../../../application/rentals/list-rentals";
import {
  acceptRentalContractByActor,
  confirmRentalPayment,
  getRentalContractDetails,
  getRentalPaymentDetails,
  getRentalReceiptDetails,
  listRentalInternalChat,
  sendRentalInternalChatMessage
} from "../../../application/rentals/manage-rental-extras";
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
  fulfillmentMethod: z.enum(["PICKUP_LOCAL", "DELIVERY_PARTNER", "DELIVERY_OWNER"]),
  deliveryAddress: z.string().optional(),
  platformFee: z.number(),
  depositAmount: z.number(),
  signalAmount: z.number(),
  remainderAmount: z.number(),
  status: z.enum(["REQUESTED", "APPROVED", "ACTIVE", "COMPLETED", "CANCELED", "DISPUTED"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const requestRentalBodySchema = z.object({
  listingId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  paymentMode: z.enum(["IN_APP_FULL", "SPLIT_SIGNAL_REMAINDER"]).optional(),
  depositAmount: z.number().nonnegative().optional(),
  signalAmount: z.number().positive().optional(),
  fulfillmentMethod: z.enum(["PICKUP_LOCAL", "DELIVERY_PARTNER", "DELIVERY_OWNER"]).optional(),
  deliveryAddress: z.string().min(8).max(300).optional()
});

const updateRentalStatusBodySchema = z.object({
  status: z.enum(["APPROVED", "ACTIVE", "COMPLETED", "CANCELED"])
});

const rentalPaymentSchema = z.object({
  id: z.string(),
  rentalId: z.string(),
  mode: z.enum(["IN_APP_FULL", "SPLIT_SIGNAL_REMAINDER"]),
  status: z.enum(["PENDING", "PARTIALLY_PAID", "PAID", "FAILED", "REFUNDED"]),
  totalAmount: z.number(),
  platformFeeAmount: z.number(),
  depositAmount: z.number(),
  signalAmount: z.number(),
  remainderAmount: z.number(),
  paidAmount: z.number(),
  inAppPaymentReference: z.string().optional(),
  proofUrl: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const confirmRentalPaymentBodySchema = z.object({
  amount: z.number().positive(),
  inAppPaymentReference: z.string().min(4).max(120).optional(),
  proofUrl: z.string().url().optional()
});

const rentalContractSchema = z.object({
  id: z.string(),
  rentalId: z.string(),
  termsVersion: z.string(),
  contractText: z.string(),
  checksum: z.string(),
  acceptedByTenantAt: z.string().datetime().optional(),
  acceptedByOwnerAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const rentalReceiptSchema = z.object({
  id: z.string(),
  rentalId: z.string(),
  receiptNumber: z.string(),
  issuedAt: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime()
});

const rentalChatMessageSchema = z.object({
  id: z.string(),
  rentalId: z.string(),
  senderId: z.string(),
  message: z.string(),
  createdAt: z.string().datetime()
});

const sendRentalChatMessageBodySchema = z.object({
  message: z.string().min(1).max(2000)
});

function serializeRental(rental: {
  id: string;
  listingId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  fulfillmentMethod: "PICKUP_LOCAL" | "DELIVERY_PARTNER" | "DELIVERY_OWNER";
  deliveryAddress?: string;
  platformFee: number;
  depositAmount: number;
  signalAmount: number;
  remainderAmount: number;
  status: "REQUESTED" | "APPROVED" | "ACTIVE" | "COMPLETED" | "CANCELED" | "DISPUTED";
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...rental,
    startDate: rental.startDate.toISOString(),
    endDate: rental.endDate.toISOString(),
    deliveryAddress: rental.deliveryAddress,
    createdAt: rental.createdAt.toISOString(),
    updatedAt: rental.updatedAt.toISOString()
  };
}

function serializeRentalPayment(payment: {
  id: string;
  rentalId: string;
  mode: "IN_APP_FULL" | "SPLIT_SIGNAL_REMAINDER";
  status: "PENDING" | "PARTIALLY_PAID" | "PAID" | "FAILED" | "REFUNDED";
  totalAmount: number;
  platformFeeAmount: number;
  depositAmount: number;
  signalAmount: number;
  remainderAmount: number;
  paidAmount: number;
  inAppPaymentReference?: string;
  proofUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...payment,
    inAppPaymentReference: payment.inAppPaymentReference,
    proofUrl: payment.proofUrl,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString()
  };
}

function serializeRentalContract(contract: {
  id: string;
  rentalId: string;
  termsVersion: string;
  contractText: string;
  checksum: string;
  acceptedByTenantAt?: Date;
  acceptedByOwnerAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...contract,
    acceptedByTenantAt: contract.acceptedByTenantAt?.toISOString(),
    acceptedByOwnerAt: contract.acceptedByOwnerAt?.toISOString(),
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString()
  };
}

function serializeRentalReceipt(receipt: {
  id: string;
  rentalId: string;
  receiptNumber: string;
  issuedAt: Date;
  payload: Record<string, unknown>;
  createdAt: Date;
}) {
  return {
    ...receipt,
    issuedAt: receipt.issuedAt.toISOString(),
    createdAt: receipt.createdAt.toISOString()
  };
}

function serializeRentalChatMessage(message: {
  id: string;
  rentalId: string;
  senderId: string;
  message: string;
  createdAt: Date;
}) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString()
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
          endDate: new Date(request.body.endDate),
          paymentMode: request.body.paymentMode,
          depositAmount: request.body.depositAmount,
          signalAmount: request.body.signalAmount,
          fulfillmentMethod: request.body.fulfillmentMethod,
          deliveryAddress: request.body.deliveryAddress
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
    url: "/rentals/:rentalId/payment",
    schema: {
      tags: ["Rentals"],
      summary: "Consulta pagamento da locacao",
      description: "Retorna dados de pagamento da locacao para participantes ou admin.",
      params: z.object({
        rentalId: z.string().uuid()
      }),
      response: {
        200: rentalPaymentSchema,
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
        const payment = await getRentalPaymentDetails({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          rentalId: request.params.rentalId
        });

        writeAuditLog(request.log, {
          action: "RENTAL_PAYMENT_FETCHED",
          actorId: context.user.id,
          entityType: "rental-payment",
          entityId: payment.id,
          metadata: {
            rentalId: payment.rentalId,
            status: payment.status
          }
        });

        return reply.status(200).send(serializeRentalPayment(payment));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "POST",
    url: "/rentals/:rentalId/payment/confirm",
    schema: {
      tags: ["Rentals"],
      summary: "Confirma pagamento de locacao",
      description: "Registra pagamento parcial ou total e gera recibo quando quitado.",
      params: z.object({
        rentalId: z.string().uuid()
      }),
      body: confirmRentalPaymentBodySchema,
      response: {
        200: z.object({
          payment: rentalPaymentSchema,
          receipt: rentalReceiptSchema.optional()
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
        const result = await confirmRentalPayment({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          rentalId: request.params.rentalId,
          amount: request.body.amount,
          inAppPaymentReference: request.body.inAppPaymentReference,
          proofUrl: request.body.proofUrl
        });

        writeAuditLog(request.log, {
          action: "RENTAL_PAYMENT_CONFIRMED",
          actorId: context.user.id,
          entityType: "rental-payment",
          entityId: result.payment.id,
          metadata: {
            rentalId: result.payment.rentalId,
            paidAmount: result.payment.paidAmount,
            status: result.payment.status
          }
        });

        return reply.status(200).send({
          payment: serializeRentalPayment(result.payment),
          receipt: result.receipt ? serializeRentalReceipt(result.receipt) : undefined
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "GET",
    url: "/rentals/:rentalId/contract",
    schema: {
      tags: ["Rentals"],
      summary: "Consulta contrato digital",
      description: "Retorna termo digital e checksum do contrato da locacao.",
      params: z.object({
        rentalId: z.string().uuid()
      }),
      response: {
        200: rentalContractSchema,
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
        const contract = await getRentalContractDetails({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          rentalId: request.params.rentalId
        });

        writeAuditLog(request.log, {
          action: "RENTAL_CONTRACT_FETCHED",
          actorId: context.user.id,
          entityType: "rental-contract",
          entityId: contract.id,
          metadata: {
            rentalId: contract.rentalId
          }
        });

        return reply.status(200).send(serializeRentalContract(contract));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "POST",
    url: "/rentals/:rentalId/contract/accept",
    schema: {
      tags: ["Rentals"],
      summary: "Aceita contrato digital",
      description: "Marca aceite do contrato por participante da locacao (locador ou locatario).",
      params: z.object({
        rentalId: z.string().uuid()
      }),
      response: {
        200: rentalContractSchema,
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
        const contract = await acceptRentalContractByActor({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          rentalId: request.params.rentalId
        });

        writeAuditLog(request.log, {
          action: "RENTAL_CONTRACT_ACCEPTED",
          actorId: context.user.id,
          entityType: "rental-contract",
          entityId: contract.id,
          metadata: {
            rentalId: contract.rentalId
          }
        });

        return reply.status(200).send(serializeRentalContract(contract));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "GET",
    url: "/rentals/:rentalId/receipt",
    schema: {
      tags: ["Rentals"],
      summary: "Consulta comprovante da locacao",
      description: "Retorna comprovante digital da locacao quando pagamento estiver quitado.",
      params: z.object({
        rentalId: z.string().uuid()
      }),
      response: {
        200: rentalReceiptSchema,
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
        const receipt = await getRentalReceiptDetails({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          rentalId: request.params.rentalId
        });

        writeAuditLog(request.log, {
          action: "RENTAL_RECEIPT_FETCHED",
          actorId: context.user.id,
          entityType: "rental-receipt",
          entityId: receipt.id,
          metadata: {
            rentalId: receipt.rentalId
          }
        });

        return reply.status(200).send(serializeRentalReceipt(receipt));
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "GET",
    url: "/rentals/:rentalId/chat/messages",
    schema: {
      tags: ["Rentals"],
      summary: "Lista mensagens internas",
      description: "Retorna mensagens internas da locacao para participantes ou admin.",
      params: z.object({
        rentalId: z.string().uuid()
      }),
      response: {
        200: z.object({
          messages: z.array(rentalChatMessageSchema)
        }),
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
        const messages = (
          await listRentalInternalChat({
            requesterId: context.user.id,
            requesterRole: context.user.role,
            rentalId: request.params.rentalId
          })
        ).map(serializeRentalChatMessage);

        writeAuditLog(request.log, {
          action: "RENTAL_CHAT_MESSAGES_FETCHED",
          actorId: context.user.id,
          entityType: "rental-chat",
          entityId: request.params.rentalId,
          metadata: {
            count: messages.length
          }
        });

        return reply.status(200).send({ messages });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "POST",
    url: "/rentals/:rentalId/chat/messages",
    schema: {
      tags: ["Rentals"],
      summary: "Envia mensagem interna",
      description: "Envia mensagem interna para o chat da locacao.",
      params: z.object({
        rentalId: z.string().uuid()
      }),
      body: sendRentalChatMessageBodySchema,
      response: {
        201: rentalChatMessageSchema,
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
        const message = await sendRentalInternalChatMessage({
          requesterId: context.user.id,
          requesterRole: context.user.role,
          rentalId: request.params.rentalId,
          message: request.body.message
        });

        writeAuditLog(request.log, {
          action: "RENTAL_CHAT_MESSAGE_SENT",
          actorId: context.user.id,
          entityType: "rental-chat",
          entityId: message.id,
          metadata: {
            rentalId: message.rentalId
          }
        });

        return reply.status(201).send(serializeRentalChatMessage(message));
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
