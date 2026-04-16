import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { env } from "../../../shared/config/env";

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

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: memoryAdapter(database),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128
    },
    socialProviders
  });
}

export type AppAuth = ReturnType<typeof createAuth>;
