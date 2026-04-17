import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { deleteCurrentUser } from "../../../application/users/delete-current-user";
import { listUsersFlow } from "../../../application/users/list-users";
import { updateCurrentUserProfile } from "../../../application/users/update-user-profile";
import { writeAuditLog } from "../../../infra/logging/audit-logger";
import { getUserById, updateUserRole } from "../../../infra/persistence/in-memory-store";
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
  reputationScore: z.number().int().nonnegative()
});

const updateRoleBodySchema = z.object({
  role: z.enum(["LOCADOR", "LOCATARIO"])
});

const updateProfileBodySchema = z.object({
  name: z.string().min(2).max(120)
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
        reputationScore: context.user.reputationScore
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
          reputationScore: updatedUser.reputationScore
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
        reputationScore: updatedUser.reputationScore
      });
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
