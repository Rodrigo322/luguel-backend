import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../../../infra/database/prisma-client";
import { env } from "../../../shared/config/env";

const passwordResetLinks = new Map<string, string>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getPasswordResetLinkForTesting(email: string): string | undefined {
  if (env.NODE_ENV !== "test") {
    return undefined;
  }

  return passwordResetLinks.get(normalizeEmail(email));
}

export function clearPasswordResetLinksForTesting(): void {
  passwordResetLinks.clear();
}

export function createAuth() {
  const database: Record<string, unknown[]> = {
    user: [],
    session: [],
    account: [],
    verification: []
  };

  const socialProviders =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET
          }
        }
      : undefined;

  const persistenceDriver = env.NODE_ENV === "test" ? "memory" : (env.PERSISTENCE_DRIVER ?? "prisma");
  const authDatabase =
    persistenceDriver === "prisma"
      ? prismaAdapter(prisma, {
          provider: "postgresql"
        })
      : memoryAdapter(database);

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: authDatabase,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      sendResetPassword: async ({ user, url }) => {
        passwordResetLinks.set(normalizeEmail(user.email), url);
      }
    },
    socialProviders
  });
}

export type AppAuth = ReturnType<typeof createAuth>;
