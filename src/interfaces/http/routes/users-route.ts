import type { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { updateUserRole } from "../../../infra/persistence/in-memory-store";
import { requireAuth } from "../auth/guards";
import type { AppAuth } from "../auth/create-auth";

const userProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["LOCADOR", "LOCATARIO", "ADMIN"]),
  reputationScore: z.number().int().nonnegative()
});

const updateRoleBodySchema = z.object({
  role: z.enum(["LOCADOR", "LOCATARIO"])
});

export async function usersRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "GET",
    url: "/users/me",
    schema: {
      tags: ["Users"],
      summary: "Consulta perfil autenticado",
      description: "Retorna perfil do usuário autenticado com role e reputação.",
      response: {
        200: userProfileSchema,
        401: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      return reply.status(200).send({
        id: context.user.id,
        name: context.user.name,
        email: context.user.email,
        role: context.user.role,
        reputationScore: context.user.reputationScore
      });
    }
  });

  typedApp.route({
    method: "PATCH",
    url: "/users/me/role",
    schema: {
      tags: ["Users"],
      summary: "Atualiza role do próprio perfil",
      description: "Permite alternar entre perfis de locador e locatário.",
      body: updateRoleBodySchema,
      response: {
        200: userProfileSchema,
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

      return reply.status(200).send({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        reputationScore: updatedUser.reputationScore
      });
    }
  });
}
