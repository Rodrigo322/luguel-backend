import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { upsertUserFromAuth } from "../../../infra/persistence/in-memory-store";
import { env } from "../../../shared/config/env";
import { requireAuth } from "../auth/guards";
import type { AppAuth } from "../auth/create-auth";

const authSignupBodySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

const authSigninBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["LOCADOR", "LOCATARIO", "ADMIN"])
});

const authSessionSchema = z.object({
  user: authUserSchema
});

async function appendSetCookie(reply: FastifyReply, response: Response): Promise<void> {
  const singleSetCookie = response.headers.get("set-cookie");

  if (singleSetCookie) {
    reply.header("set-cookie", singleSetCookie);
  }
}

export async function authRoute(app: FastifyInstance, auth: AppAuth): Promise<void> {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.route({
    method: "POST",
    url: "/auth/signup",
    schema: {
      tags: ["Auth"],
      summary: "Cria conta com email e senha",
      description: "Realiza cadastro de usuário com autenticação gerenciada via Better Auth.",
      body: authSignupBodySchema,
      response: {
        201: authSessionSchema,
        400: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const authResponse = await auth.api.signUpEmail({
        body: request.body,
        headers: fromNodeHeaders(request.headers),
        asResponse: true
      });

      if (authResponse.status >= 400) {
        return reply.status(400).send({
          error: "SignUpError",
          message: "Unable to complete sign up request."
        });
      }

      const payload = (await authResponse.json()) as {
        user: { id: string; name: string; email: string };
      };

      await appendSetCookie(reply, authResponse);

      const user = await upsertUserFromAuth({
        id: payload.user.id,
        email: payload.user.email,
        name: payload.user.name
      });

      return reply.status(201).send({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    }
  });

  typedApp.route({
    method: "POST",
    url: "/auth/signin",
    schema: {
      tags: ["Auth"],
      summary: "Efetua login com email e senha",
      description: "Realiza autenticação de usuário por credenciais locais e cria sessão segura.",
      body: authSigninBodySchema,
      response: {
        200: authSessionSchema,
        401: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const authResponse = await auth.api.signInEmail({
        body: request.body,
        headers: fromNodeHeaders(request.headers),
        asResponse: true
      });

      if (authResponse.status >= 400) {
        return reply.status(401).send({
          error: "InvalidCredentials",
          message: "Invalid credentials."
        });
      }

      const payload = (await authResponse.json()) as {
        user: { id: string; name: string; email: string };
      };

      await appendSetCookie(reply, authResponse);

      const user = await upsertUserFromAuth({
        id: payload.user.id,
        email: payload.user.email,
        name: payload.user.name
      });

      return reply.status(200).send({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    }
  });

  typedApp.route({
    method: "POST",
    url: "/auth/signout",
    schema: {
      tags: ["Auth"],
      summary: "Encerra a sessão atual",
      description: "Realiza logout do usuário autenticado.",
      response: {
        200: z.object({ message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const authResponse = await auth.api.signOut({
        headers: fromNodeHeaders(request.headers),
        asResponse: true
      });

      await appendSetCookie(reply, authResponse);

      return reply.status(200).send({
        message: "Successfully signed out."
      });
    }
  });

  typedApp.route({
    method: "GET",
    url: "/auth/session",
    schema: {
      tags: ["Auth"],
      summary: "Retorna sessão autenticada",
      description: "Consulta dados da sessão atual e perfil de acesso do usuário.",
      response: {
        200: authSessionSchema,
        401: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const context = await requireAuth(auth, request, reply);

      if (!context) {
        return;
      }

      return reply.status(200).send({
        user: {
          id: context.user.id,
          name: context.user.name,
          email: context.user.email,
          role: context.user.role
        }
      });
    }
  });

  typedApp.route({
    method: "GET",
    url: "/auth/social/google",
    schema: {
      tags: ["Auth"],
      summary: "Inicia login social Google",
      description: "Inicia fluxo OAuth do Google quando credenciais sociais estão configuradas.",
      response: {
        200: z.object({
          url: z.string().url()
        }),
        503: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
        return reply.status(503).send({
          error: "ProviderNotConfigured",
          message: "Google social login is not configured."
        });
      }

      const callbackURL = `${env.BETTER_AUTH_URL}/api/auth/callback/google`;

      const authResponse = await auth.api.signInSocial({
        body: {
          provider: "google",
          callbackURL
        },
        headers: fromNodeHeaders(request.headers),
        asResponse: true
      });

      if (authResponse.status >= 400) {
        return reply.status(503).send({
          error: "SocialSignInUnavailable",
          message: "Google social login is currently unavailable."
        });
      }

      await appendSetCookie(reply, authResponse);

      const payload = (await authResponse.json()) as { url: string };

      return reply.status(200).send(payload);
    }
  });
}
