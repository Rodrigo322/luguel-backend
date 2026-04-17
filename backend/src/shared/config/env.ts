import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/luguel?schema=public"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32)
    .default("change-this-secret-in-production-with-at-least-32-chars"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3333"),
  PASSWORD_RESET_REDIRECT_URL: z.string().url().default("http://localhost:3333/reset-password"),
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
