import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { env } from "../../shared/config/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const globalForPgPool = globalThis as unknown as { pgPool?: Pool };

const pool =
  globalForPgPool.pgPool ??
  new Pool({
    connectionString: env.DATABASE_URL
  });

if (env.NODE_ENV !== "production") {
  globalForPgPool.pgPool = pool;
}

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["error"]
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
