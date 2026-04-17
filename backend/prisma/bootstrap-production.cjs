const { config } = require("dotenv");
const { Pool } = require("pg");
const { spawnSync } = require("node:child_process");
const { existsSync, writeFileSync } = require("node:fs");
const path = require("node:path");

config();

function runScript(script) {
  const result = spawnSync("npm run " + script, {
    shell: true,
    stdio: "inherit",
    env: process.env
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: npm run ${script}`);
  }
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

function resolveTargetDatabaseName(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const dbName = parsed.pathname.replace(/^\//, "").trim();
  if (!dbName) {
    throw new Error("DATABASE_URL does not include a database name.");
  }

  return dbName;
}

function resolveAdminDatabaseUrl(databaseUrl) {
  const explicitAdminUrl = String(process.env.DATABASE_ADMIN_URL || "").trim();
  if (explicitAdminUrl) {
    return explicitAdminUrl;
  }

  const parsed = new URL(databaseUrl);
  parsed.pathname = "/postgres";
  return parsed.toString();
}

async function ensureDatabaseExists() {
  const shouldEnsure = String(process.env.DEPLOY_ENSURE_DATABASE || "true").toLowerCase() !== "false";
  if (!shouldEnsure) {
    console.log("[deploy] Skipping database creation step (DEPLOY_ENSURE_DATABASE=false).");
    return;
  }

  const databaseUrl = String(process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to prepare production deployment.");
  }

  const targetDb = resolveTargetDatabaseName(databaseUrl);
  const adminUrl = resolveAdminDatabaseUrl(databaseUrl);
  const pool = new Pool({ connectionString: adminUrl });

  try {
    console.log(`[deploy] Checking if database "${targetDb}" exists...`);
    const existsResult = await pool.query("SELECT 1 FROM pg_database WHERE datname = $1", [targetDb]);

    if (existsResult.rowCount && existsResult.rowCount > 0) {
      console.log(`[deploy] Database "${targetDb}" already exists.`);
      return;
    }

    console.log(`[deploy] Creating database "${targetDb}"...`);
    await pool.query(`CREATE DATABASE ${quoteIdentifier(targetDb)}`);
    console.log(`[deploy] Database "${targetDb}" created successfully.`);
  } catch (error) {
    const failOnCreateError = String(process.env.DEPLOY_FAIL_ON_DB_CREATE_ERROR || "false").toLowerCase() === "true";
    const message = error instanceof Error ? error.message : String(error);

    if (failOnCreateError) {
      throw new Error(`[deploy] Failed to ensure database exists: ${message}`);
    }

    console.warn(`[deploy] Could not auto-create database. Continuing deployment. Details: ${message}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  const isVercel = String(process.env.VERCEL || "").trim() === "1";
  const vercelEnv = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  const forceOnAnyEnv = String(process.env.DEPLOY_PREPARE_ALWAYS || "false").toLowerCase() === "true";
  const shouldRunDataBootstrap = !isVercel || vercelEnv === "production" || forceOnAnyEnv;
  const markerFile = path.join(process.cwd(), ".deploy-prepare.done");

  if (isVercel && existsSync(markerFile)) {
    console.log("[deploy] Bootstrap already executed in this build container. Skipping.");
    return;
  }

  console.log("[deploy] Running Prisma generate...");
  runScript("prisma:generate");

  if (!shouldRunDataBootstrap) {
    console.log(`[deploy] Skipping migrations and seed for VERCEL_ENV=${vercelEnv || "unknown"}.`);
    return;
  }

  await ensureDatabaseExists();

  console.log("[deploy] Applying Prisma migrations...");
  runScript("prisma:deploy");

  console.log("[deploy] Seeding admin users...");
  runScript("prisma:seed:admins");

  if (isVercel) {
    writeFileSync(markerFile, new Date().toISOString(), "utf-8");
  }

  console.log("[deploy] Deployment bootstrap completed.");
}

main().catch((error) => {
  console.error("[deploy] Bootstrap failed.");
  console.error(error);
  process.exitCode = 1;
});
