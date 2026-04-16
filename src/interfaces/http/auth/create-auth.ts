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

type BetterAuthFactory = (options: Record<string, unknown>) => unknown;
type MemoryAdapterFactory = (database: Record<string, unknown[]>) => unknown;
type PrismaAdapterFactory = (client: unknown, options: { provider: string }) => unknown;

interface BetterAuthDependencies {
  betterAuth: BetterAuthFactory;
  memoryAdapter: MemoryAdapterFactory;
  prismaAdapter: PrismaAdapterFactory;
}

let betterAuthDependenciesPromise: Promise<BetterAuthDependencies> | null = null;

async function loadBetterAuthDependencies(): Promise<BetterAuthDependencies> {
  if (!betterAuthDependenciesPromise) {
    betterAuthDependenciesPromise = Promise.all([
      import("better-auth") as Promise<{ betterAuth: BetterAuthFactory }>,
      import("better-auth/adapters/memory") as Promise<{ memoryAdapter: MemoryAdapterFactory }>,
      import("better-auth/adapters/prisma") as Promise<{ prismaAdapter: PrismaAdapterFactory }>
    ]).then(([betterAuthModule, memoryAdapterModule, prismaAdapterModule]) => ({
      betterAuth: betterAuthModule.betterAuth,
      memoryAdapter: memoryAdapterModule.memoryAdapter,
      prismaAdapter: prismaAdapterModule.prismaAdapter
    }));
  }

  return betterAuthDependenciesPromise;
}

export async function createAuth() {
  const { betterAuth, memoryAdapter, prismaAdapter } = await loadBetterAuthDependencies();

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
      sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
        passwordResetLinks.set(normalizeEmail(user.email), url);
      }
    },
    socialProviders
  }) as any;
}

export type AppAuth = any;
