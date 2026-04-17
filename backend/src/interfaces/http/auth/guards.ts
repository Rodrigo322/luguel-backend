import type { FastifyReply, FastifyRequest } from "fastify";
import { writeAuditLog } from "../../../infra/logging/audit-logger";
import { upsertUserFromAuth, type StoredUser } from "../../../infra/persistence/in-memory-store";
import type { UserRole } from "../../../shared/types/role";
import type { AppAuth } from "./create-auth";
import { loadBetterAuthNode } from "./load-better-auth-node";

export interface AuthContext {
  session: {
    session: Record<string, unknown>;
    user: {
      id: string;
      email: string;
      name: string;
    };
  };
  user: StoredUser;
}

export async function requireAuth(
  auth: AppAuth,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<AuthContext | null> {
  const { fromNodeHeaders } = await loadBetterAuthNode();

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers)
  });

  if (!session?.user) {
    writeAuditLog(request.log, {
      action: "AUTH_REQUIRED_FAILED",
      entityType: "session",
      entityId: "anonymous",
      metadata: {
        method: request.method,
        url: request.url,
        ip: request.ip
      }
    });

    await reply.status(401).send({
      error: "Unauthorized",
      message: "Authentication required."
    });
    return null;
  }

  const user = await upsertUserFromAuth({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name
  });

  return {
    session: {
      session: session.session as Record<string, unknown>,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name
      }
    },
    user
  };
}

export function requireRoles(
  context: AuthContext,
  roles: UserRole[],
  reply: FastifyReply
): boolean {
  if (roles.includes(context.user.role)) {
    return true;
  }

  void reply.status(403).send({
    error: "Forbidden",
    message: "Insufficient role permissions."
  });

  writeAuditLog(reply.log, {
    action: "AUTHORIZATION_DENIED",
    actorId: context.user.id,
    entityType: "role",
    entityId: context.user.role,
    metadata: {
      requiredRoles: roles,
      method: reply.request.method,
      url: reply.request.url
    }
  });

  return false;
}
