import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { deleteCurrentUser } from "../../../application/users/delete-current-user";
import { listUsersFlow } from "../../../application/users/list-users";
import {
  getPremiumStatusFlow,
  subscribePremiumFlow
} from "../../../application/users/subscribe-premium";
import { submitIdentityVerificationFlow } from "../../../application/users/submit-identity-verification";
import { updateCurrentUserProfile } from "../../../application/users/update-user-profile";
import { writeAuditLog } from "../../../infra/logging/audit-logger";
import {
  getUserById,
  updateUserRole
} from "../../../infra/persistence/in-memory-store";
import { requireAuth, requireRoles } from "../auth/guards";
import type { AppAuth } from "../auth/create-auth";
import { loadBetterAuthNode } from "../auth/load-better-auth-node";
import { handleDomainError } from "../errors/handle-domain-error";

const userProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["LOCADOR", "LOCATARIO", "ADMIN"]),
  isBanned: z.boolean(),
  bannedAt: z.string().datetime().optional(),
  reputationScore: z.number().int().nonnegative(),
  identityVerificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  identityVerifiedAt: z.string().datetime().optional(),
  plan: z.enum(["FREE", "PREMIUM"]),
  planExpiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const userSelfSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["LOCADOR", "LOCATARIO", "ADMIN"]),
  isBanned: z.boolean(),
  bannedAt: z.string().datetime().optional(),
  reputationScore: z.number().int().nonnegative(),
  identityVerificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  identityVerifiedAt: z.string().datetime().optional(),
  plan: z.enum(["FREE", "PREMIUM"]),
  planExpiresAt: z.string().datetime().optional()
});

const updateRoleBodySchema = z.object({
  role: z.enum(["LOCADOR", "LOCATARIO"])
});

const updateProfileBodySchema = z.object({
  name: z.string().min(2).max(120)
});

const submitIdentityVerificationBodySchema = z.object({
  documentType: z.enum(["CPF", "CNPJ", "RG", "CNH", "PASSPORT"]),
  documentNumber: z.string().min(5).max(40),
  fullName: z.string().min(5).max(180),
  birthDate: z.string().datetime()
});

const identityVerificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  documentType: z.string(),
  fullName: z.string(),
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  notes: z.string().optional(),
  submittedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

const premiumSubscribeBodySchema = z.object({
  months: z.number().int().min(1).max(12),
  amount: z.number().positive(),
  paymentConfirmed: z.boolean()
});

const premiumStatusSchema = z.object({
  plan: z.enum(["FREE", "PREMIUM"]),
  planExpiresAt: z.string().datetime().optional(),
  subscription: z
    .object({
      id: z.string(),
      status: z.enum(["ACTIVE", "CANCELED", "EXPIRED"]),
      amount: z.number(),
      months: z.number().int(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime()
    })
    .nullable()
});

export async function usersRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const { fromNodeHeaders } = await loadBetterAuthNode();
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "GET",
    url: "/users/me",
    schema: {
      tags: ["Users"],
      summary: "Consulta perfil autenticado",
      description: "Retorna perfil do usuario autenticado com role e reputacao.",
      response: {
        200: userSelfSchema,
        401: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      writeAuditLog(request.log, {
        action: "USER_PROFILE_FETCHED",
        actorId: context.user.id,
        entityType: "user",
        entityId: context.user.id
      });

      return reply.status(200).send({
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        role: context.user.role,
        isBanned: context.user.isBanned,
        bannedAt: context.user.bannedAt?.toISOString(),
        reputationScore: context.user.reputationScore,
        identityVerificationStatus: context.user.identityVerificationStatus,
        identityVerifiedAt: context.user.identityVerifiedAt?.toISOString(),
        plan: context.user.plan,
        planExpiresAt: context.user.planExpiresAt?.toISOString()
      });
    }
  });

  typedApp.route({
    method: "GET",
    url: "/users",
    schema: {
      tags: ["Users"],
      summary: "Lista usuarios",
      description: "Retorna lista de usuarios cadastrados (apenas admin).",
      response: {
        200: z.object({
          users: z.array(userProfileSchema)
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

      const users = (await listUsersFlow()).map((user) => ({
        ...user,
        bannedAt: user.bannedAt?.toISOString(),
        identityVerifiedAt: user.identityVerifiedAt?.toISOString(),
        planExpiresAt: user.planExpiresAt?.toISOString(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }));

      writeAuditLog(request.log, {
        action: "USERS_LIST_FETCHED",
        actorId: context.user.id,
        entityType: "user",
        entityId: "collection",
        metadata: {
          count: users.length
        }
      });

      return reply.status(200).send({ users });
    }
  });

  typedApp.route({
    method: "GET",
    url: "/users/:userId",
    schema: {
      tags: ["Users"],
      summary: "Consulta usuario por id",
      description: "Retorna usuario especifico para moderacao (apenas admin).",
      params: z.object({
        userId: z.string().min(1)
      }),
      response: {
        200: userProfileSchema,
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

      const user = await getUserById(request.params.userId);

      if (!user) {
        return reply.status(404).send({
          error: "UserNotFound",
          message: "User not found."
        });
      }

      writeAuditLog(request.log, {
        action: "USER_FETCHED_BY_ADMIN",
        actorId: context.user.id,
        entityType: "user",
        entityId: user.id
      });

      return reply.status(200).send({
        ...user,
        bannedAt: user.bannedAt?.toISOString(),
        identityVerifiedAt: user.identityVerifiedAt?.toISOString(),
        planExpiresAt: user.planExpiresAt?.toISOString(),
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      });
    }
  });

  typedApp.route({
    method: "PATCH",
    url: "/users/me",
    schema: {
      tags: ["Users"],
      summary: "Atualiza proprio perfil",
      description: "Atualiza dados editaveis do usuario autenticado.",
      body: updateProfileBodySchema,
      response: {
        200: userSelfSchema,
        400: z.object({ error: z.string(), message: z.string() }),
        401: z.object({ error: z.string(), message: z.string() }),
        404: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      try {
        const updatedUser = await updateCurrentUserProfile({
          requesterId: context.user.id,
          name: request.body.name
        });

        writeAuditLog(request.log, {
          action: "USER_PROFILE_UPDATED",
          actorId: context.user.id,
          entityType: "user",
          entityId: updatedUser.id
        });

        return reply.status(200).send({
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          isBanned: updatedUser.isBanned,
          bannedAt: updatedUser.bannedAt?.toISOString(),
          reputationScore: updatedUser.reputationScore,
          identityVerificationStatus: updatedUser.identityVerificationStatus,
          identityVerifiedAt: updatedUser.identityVerifiedAt?.toISOString(),
          plan: updatedUser.plan,
          planExpiresAt: updatedUser.planExpiresAt?.toISOString()
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "PATCH",
    url: "/users/me/role",
    schema: {
      tags: ["Users"],
      summary: "Atualiza role do proprio perfil",
      description: "Permite alternar entre perfis de locador e locatario.",
      body: updateRoleBodySchema,
      response: {
        200: userSelfSchema,
        401: z.object({ error: z.string(), message: z.string() }),
        404: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      const updatedUser = await updateUserRole(context.user.id, request.body.role);

      if (!updatedUser) {
        return reply.status(404).send({
          error: "UserNotFound",
          message: "Authenticated user was not found."
        });
      }

      writeAuditLog(request.log, {
        action: "USER_ROLE_UPDATED",
        actorId: context.user.id,
        entityType: "user",
        entityId: context.user.id,
        metadata: {
          newRole: updatedUser.role
        }
      });

      return reply.status(200).send({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        isBanned: updatedUser.isBanned,
        bannedAt: updatedUser.bannedAt?.toISOString(),
        reputationScore: updatedUser.reputationScore,
        identityVerificationStatus: updatedUser.identityVerificationStatus,
        identityVerifiedAt: updatedUser.identityVerifiedAt?.toISOString(),
        plan: updatedUser.plan,
        planExpiresAt: updatedUser.planExpiresAt?.toISOString()
      });
    }
  });

  typedApp.route({
    method: "POST",
    url: "/users/me/identity-verification",
    schema: {
      tags: ["Users"],
      summary: "Envia verificacao de identidade",
      description: "Submete dados de documento para verificacao de identidade (KYC simplificado).",
      body: submitIdentityVerificationBodySchema,
      response: {
        200: identityVerificationSchema,
        400: z.object({ error: z.string(), message: z.string() }),
        401: z.object({ error: z.string(), message: z.string() }),
        404: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      try {
        const verification = await submitIdentityVerificationFlow({
          requesterId: context.user.id,
          documentType: request.body.documentType,
          documentNumber: request.body.documentNumber,
          fullName: request.body.fullName,
          birthDate: new Date(request.body.birthDate)
        });

        writeAuditLog(request.log, {
          action: "USER_IDENTITY_VERIFICATION_SUBMITTED",
          actorId: context.user.id,
          entityType: "identity-verification",
          entityId: verification.id,
          metadata: {
            documentType: verification.documentType,
            status: verification.status
          }
        });

        return reply.status(200).send({
          id: verification.id,
          userId: verification.userId,
          documentType: verification.documentType,
          fullName: verification.fullName,
          status: verification.status,
          notes: verification.notes,
          submittedAt: verification.submittedAt.toISOString(),
          reviewedAt: verification.reviewedAt?.toISOString(),
          createdAt: verification.createdAt.toISOString(),
          updatedAt: verification.updatedAt.toISOString()
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "GET",
    url: "/users/me/premium",
    schema: {
      tags: ["Users"],
      summary: "Consulta plano premium",
      description: "Retorna status atual do plano premium para anunciantes.",
      response: {
        200: premiumStatusSchema,
        401: z.object({ error: z.string(), message: z.string() }),
        404: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      try {
        const premium = await getPremiumStatusFlow(context.user.id);

        return reply.status(200).send({
          plan: premium.plan,
          planExpiresAt: premium.planExpiresAt?.toISOString(),
          subscription: premium.subscription
            ? {
                id: premium.subscription.id,
                status: premium.subscription.status,
                amount: premium.subscription.amount,
                months: premium.subscription.months,
                startsAt: premium.subscription.startsAt.toISOString(),
                endsAt: premium.subscription.endsAt.toISOString(),
                createdAt: premium.subscription.createdAt.toISOString(),
                updatedAt: premium.subscription.updatedAt.toISOString()
              }
            : null
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "POST",
    url: "/users/me/premium/subscribe",
    schema: {
      tags: ["Users"],
      summary: "Assina plano premium",
      description: "Ativa plano premium para anunciantes, usado no modelo de negocio da plataforma.",
      body: premiumSubscribeBodySchema,
      response: {
        201: premiumStatusSchema,
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
        await subscribePremiumFlow({
          requesterId: context.user.id,
          months: request.body.months,
          amount: request.body.amount,
          paymentConfirmed: request.body.paymentConfirmed
        });

        const premium = await getPremiumStatusFlow(context.user.id);

        writeAuditLog(request.log, {
          action: "USER_PREMIUM_SUBSCRIBED",
          actorId: context.user.id,
          entityType: "subscription",
          entityId: premium.subscription?.id ?? "latest",
          metadata: {
            plan: premium.plan,
            expiresAt: premium.planExpiresAt?.toISOString()
          }
        });

        return reply.status(201).send({
          plan: premium.plan,
          planExpiresAt: premium.planExpiresAt?.toISOString(),
          subscription: premium.subscription
            ? {
                id: premium.subscription.id,
                status: premium.subscription.status,
                amount: premium.subscription.amount,
                months: premium.subscription.months,
                startsAt: premium.subscription.startsAt.toISOString(),
                endsAt: premium.subscription.endsAt.toISOString(),
                createdAt: premium.subscription.createdAt.toISOString(),
                updatedAt: premium.subscription.updatedAt.toISOString()
              }
            : null
        });
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });

  typedApp.route({
    method: "DELETE",
    url: "/users/me",
    schema: {
      tags: ["Users"],
      summary: "Remove propria conta",
      description: "Remove conta do usuario autenticado (admin nao pode se auto-remover por esta rota).",
      response: {
        204: z.null(),
        400: z.object({ error: z.string(), message: z.string() }),
        401: z.object({ error: z.string(), message: z.string() }),
        404: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      try {
        await deleteCurrentUser({
          requesterId: context.user.id
        });

        const signOutResponse = await auth.api.signOut({
          headers: fromNodeHeaders(request.headers),
          asResponse: true
        });

        const singleSetCookie = signOutResponse.headers.get("set-cookie");
        if (singleSetCookie) {
          reply.header("set-cookie", singleSetCookie);
        }

        writeAuditLog(request.log, {
          action: "USER_ACCOUNT_DELETED",
          actorId: context.user.id,
          entityType: "user",
          entityId: context.user.id
        });

        return reply.status(204).send(null);
      } catch (error) {
        handleDomainError(reply, error);
      }
    }
  });
}
