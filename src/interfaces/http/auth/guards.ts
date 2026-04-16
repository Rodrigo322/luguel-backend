import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import { upsertUserFromAuth, type StoredUser } from "../../../infra/persistence/in-memory-store";
import type { UserRole } from "../../../shared/types/role";
import type { AppAuth } from "./create-auth";

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
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers)
  });

  if (!session?.user) {
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

  return false;
}
