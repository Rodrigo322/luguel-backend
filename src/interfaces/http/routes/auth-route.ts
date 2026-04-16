import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { writeAuditLog } from "../../../infra/logging/audit-logger";
import { upsertUserFromAuth } from "../../../infra/persistence/in-memory-store";
import { env } from "../../../shared/config/env";
import { requireAuth } from "../auth/guards";
import { loadBetterAuthNode } from "../auth/load-better-auth-node";
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

const authForgotPasswordBodySchema = z.object({
  email: z.string().email()
});

const authResetPasswordBodySchema = z.object({
  token: z.string().min(8),
  newPassword: z.string().min(8).max(128)
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
  const { fromNodeHeaders } = await loadBetterAuthNode();
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
        writeAuditLog(request.log, {
          action: "SIGNUP_FAILED",
          entityType: "auth",
          entityId: request.body.email.toLowerCase(),
          metadata: {
            reason: "provider-rejected-request"
          }
        });

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

      writeAuditLog(request.log, {
        action: "SIGNUP_SUCCEEDED",
        actorId: user.id,
        entityType: "user",
        entityId: user.id,
        metadata: {
          email: user.email,
          role: user.role
        }
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
        writeAuditLog(request.log, {
          action: "SIGNIN_FAILED",
          entityType: "auth",
          entityId: request.body.email.toLowerCase(),
          metadata: {
            reason: "invalid-credentials"
          }
        });

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

      writeAuditLog(request.log, {
        action: "SIGNIN_SUCCEEDED",
        actorId: user.id,
        entityType: "session",
        entityId: user.id,
        metadata: {
          email: user.email,
          role: user.role
        }
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

      writeAuditLog(request.log, {
        action: "SIGNOUT_SUCCEEDED",
        entityType: "session",
        entityId: "current-session"
      });

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

      writeAuditLog(request.log, {
        action: "SESSION_FETCHED",
        actorId: context.user.id,
        entityType: "session",
        entityId: context.user.id
      });

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
    method: "POST",
    url: "/auth/session/refresh",
    schema: {
      tags: ["Auth"],
      summary: "Renova sessão atual",
      description: "Valida e renova sessão atual retornando perfil do usuário autenticado.",
      response: {
        200: authSessionSchema,
        401: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const authResponse = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
        asResponse: true
      });

      if (authResponse.status >= 400) {
        writeAuditLog(request.log, {
          action: "SESSION_REFRESH_FAILED",
          entityType: "session",
          entityId: "current-session"
        });

        return reply.status(401).send({
          error: "Unauthorized",
          message: "Authentication required."
        });
      }

      const payload = (await authResponse.json()) as {
        user?: { id: string; name: string; email: string };
      };

      if (!payload.user) {
        return reply.status(401).send({
          error: "Unauthorized",
          message: "Authentication required."
        });
      }

      await appendSetCookie(reply, authResponse);

      const user = await upsertUserFromAuth({
        id: payload.user.id,
        email: payload.user.email,
        name: payload.user.name
      });

      writeAuditLog(request.log, {
        action: "SESSION_REFRESHED",
        actorId: user.id,
        entityType: "session",
        entityId: user.id
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
    url: "/auth/password/forgot",
    schema: {
      tags: ["Auth"],
      summary: "Solicita recuperação de senha",
      description: "Inicia fluxo de recuperação de senha sem revelar existência de usuário.",
      body: authForgotPasswordBodySchema,
      response: {
        200: z.object({ message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const authResponse = await auth.api.requestPasswordReset({
        body: {
          email: request.body.email,
          redirectTo: env.PASSWORD_RESET_REDIRECT_URL
        },
        headers: fromNodeHeaders(request.headers),
        asResponse: true
      });

      if (authResponse.status >= 400) {
        writeAuditLog(request.log, {
          action: "PASSWORD_RESET_REQUEST_FAILED",
          entityType: "auth",
          entityId: request.body.email.toLowerCase(),
          metadata: {
            reason: "provider-rejected-request"
          }
        });
      } else {
        writeAuditLog(request.log, {
          action: "PASSWORD_RESET_REQUESTED",
          entityType: "auth",
          entityId: request.body.email.toLowerCase()
        });
      }

      return reply.status(200).send({
        message: "If the account exists, password reset instructions were sent."
      });
    }
  });

  typedApp.route({
    method: "POST",
    url: "/auth/password/reset",
    schema: {
      tags: ["Auth"],
      summary: "Redefine senha",
      description: "Conclui recuperação de senha com token recebido no fluxo de reset.",
      body: authResetPasswordBodySchema,
      response: {
        200: z.object({ message: z.string() }),
        400: z.object({ error: z.string(), message: z.string() })
      }
    },
    handler: async (request, reply) => {
      const authResponse = await auth.api.resetPassword({
        body: {
          token: request.body.token,
          newPassword: request.body.newPassword
        },
        headers: fromNodeHeaders(request.headers),
        asResponse: true
      });

      if (authResponse.status >= 400) {
        writeAuditLog(request.log, {
          action: "PASSWORD_RESET_FAILED",
          entityType: "auth",
          entityId: "password-reset"
        });

        return reply.status(400).send({
          error: "PasswordResetFailed",
          message: "Unable to reset password with provided token."
        });
      }

      await appendSetCookie(reply, authResponse);

      writeAuditLog(request.log, {
        action: "PASSWORD_RESET_SUCCEEDED",
        entityType: "auth",
        entityId: "password-reset"
      });

      return reply.status(200).send({
        message: "Password reset successfully."
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
        writeAuditLog(request.log, {
          action: "SOCIAL_GOOGLE_UNAVAILABLE",
          entityType: "auth",
          entityId: "google",
          metadata: {
            reason: "provider-not-configured"
          }
        });

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
        writeAuditLog(request.log, {
          action: "SOCIAL_GOOGLE_UNAVAILABLE",
          entityType: "auth",
          entityId: "google",
          metadata: {
            reason: "provider-unavailable"
          }
        });

        return reply.status(503).send({
          error: "SocialSignInUnavailable",
          message: "Google social login is currently unavailable."
        });
      }

      await appendSetCookie(reply, authResponse);

      const payload = (await authResponse.json()) as { url: string };

      writeAuditLog(request.log, {
        action: "SOCIAL_GOOGLE_STARTED",
        entityType: "auth",
        entityId: "google"
      });

      return reply.status(200).send(payload);
    }
  });
}
