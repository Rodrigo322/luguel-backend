import { config } from "dotenv";
import { z } from "zod";

config();

const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/luguel?schema=public";
const DEFAULT_AUTH_SECRET = "change-this-secret-in-production-with-at-least-32-chars";
const DEFAULT_AUTH_URL = "http://localhost:3333";
const DEFAULT_PASSWORD_RESET_REDIRECT_URL = "http://localhost:3333/reset-password";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z
    .string()
    .min(1)
    .default(DEFAULT_DATABASE_URL),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default(DEFAULT_AUTH_SECRET),
  BETTER_AUTH_URL: z.string().url().default(DEFAULT_AUTH_URL),
  PASSWORD_RESET_REDIRECT_URL: z.string().url().default(DEFAULT_PASSWORD_RESET_REDIRECT_URL),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().default(""),
  PERSISTENCE_DRIVER: z.enum(["memory", "prisma"]).optional(),
  UPLOAD_MAX_SIZE_MB: z.coerce.number().int().positive().max(20).default(5)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const messages = parsedEnv.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return `${path}: ${issue.message}`;
  });

  throw new Error(`Invalid environment configuration: ${messages.join("; ")}`);
}

export const env = parsedEnv.data;

if (env.NODE_ENV === "production") {
  const productionConfigIssues: string[] = [];

  if (env.BETTER_AUTH_SECRET === DEFAULT_AUTH_SECRET) {
    productionConfigIssues.push("BETTER_AUTH_SECRET must be configured with a strong secret in production");
  }

  if (env.DATABASE_URL === DEFAULT_DATABASE_URL || env.DATABASE_URL.includes("localhost")) {
    productionConfigIssues.push("DATABASE_URL must target the production database and cannot point to localhost");
  }

  if (env.BETTER_AUTH_URL === DEFAULT_AUTH_URL || env.BETTER_AUTH_URL.includes("localhost")) {
    productionConfigIssues.push("BETTER_AUTH_URL must be a public production URL");
  }

  if (
    env.PASSWORD_RESET_REDIRECT_URL === DEFAULT_PASSWORD_RESET_REDIRECT_URL ||
    env.PASSWORD_RESET_REDIRECT_URL.includes("localhost")
  ) {
    productionConfigIssues.push("PASSWORD_RESET_REDIRECT_URL must be a public production URL");
  }

  if (productionConfigIssues.length > 0) {
    throw new Error(`Unsafe production environment configuration: ${productionConfigIssues.join("; ")}`);
  }
}
