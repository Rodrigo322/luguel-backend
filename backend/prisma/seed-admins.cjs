const { config } = require("dotenv");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

config();

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function buildNameFromEmail(email) {
  const localPart = normalizeEmail(email).split("@")[0] || "admin";
  return localPart
    .split(/[._-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseAdminsFromStructuredEnv() {
  const raw = String(process.env.ADMIN_SEED_USERS || "").trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [name, email, password] = entry.split("|").map((part) => String(part || "").trim());

      if (!name || !email || !password) {
        throw new Error(
          `Invalid ADMIN_SEED_USERS entry at position ${index + 1}. Use: "Name|email@domain.com|StrongPassword".`
        );
      }

      return {
        name,
        email: normalizeEmail(email),
        password
      };
    });
}

function resolveSeedAdmins() {
  const structuredAdmins = parseAdminsFromStructuredEnv();
  if (structuredAdmins.length > 0) {
    return structuredAdmins;
  }

  const defaultPassword = String(process.env.ADMIN_SEED_PASSWORD || "").trim() || "Admin#12345678";
  const defaultEmails =
    String(process.env.ADMIN_SEED_EMAILS || "").trim() || "admin@luguel.dev,moderator@luguel.dev";

  return defaultEmails
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean)
    .map((email) => ({
      name: buildNameFromEmail(email),
      email,
      password: defaultPassword
    }));
}

async function createAuthAndHeaders(prisma) {
  const [{ betterAuth }, { prismaAdapter }, { fromNodeHeaders }] = await Promise.all([
    import("better-auth"),
    import("better-auth/adapters/prisma"),
    import("better-auth/node")
  ]);

  const betterAuthUrl = String(process.env.BETTER_AUTH_URL || "http://localhost:3333");
  const betterAuthSecret =
    String(process.env.BETTER_AUTH_SECRET || "").trim() ||
    "change-this-secret-in-production-with-at-least-32-chars";
  const authBaseUrl = new URL(betterAuthUrl);

  const auth = betterAuth({
    baseURL: betterAuthUrl,
    secret: betterAuthSecret,
    trustedOrigins: [betterAuthUrl],
    database: prismaAdapter(prisma, {
      provider: "postgresql"
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      sendResetPassword: async () => {}
    }
  });

  const requestHeaders = fromNodeHeaders({
    host: authBaseUrl.host,
    origin: betterAuthUrl,
    "x-forwarded-proto": authBaseUrl.protocol.replace(":", ""),
    "user-agent": "luguel-admin-seed-script"
  });

  return { auth, requestHeaders };
}

async function seedAdmins() {
  const databaseUrl =
    String(process.env.DATABASE_URL || "").trim() ||
    "postgresql://postgres:postgres@localhost:5432/luguel?schema=public";

  const pool = new Pool({
    connectionString: databaseUrl
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log: ["error"]
  });

  try {
    const admins = resolveSeedAdmins();

    if (admins.length === 0) {
      throw new Error("No admin users resolved for seed.");
    }

    const { auth, requestHeaders } = await createAuthAndHeaders(prisma);
    const seededCredentials = [];
    const warnings = [];

    for (const admin of admins) {
      const existingUser = await prisma.user.findUnique({
        where: { email: admin.email }
      });

      if (!existingUser) {
        const signUpResponse = await auth.api.signUpEmail({
          body: {
            name: admin.name,
            email: admin.email,
            password: admin.password
          },
          headers: requestHeaders,
          asResponse: true
        });

        if (signUpResponse.status >= 400) {
          const responseBody = await signUpResponse.text();
          throw new Error(
            `Failed to sign up ${admin.email}. Status ${signUpResponse.status}. Response: ${responseBody}`
          );
        }
      }

      const ensuredUser = await prisma.user.upsert({
        where: { email: admin.email },
        update: {
          name: admin.name,
          role: "ADMIN",
          isBanned: false,
          bannedAt: null,
          emailVerified: true
        },
        create: {
          name: admin.name,
          email: admin.email,
          emailVerified: true,
          role: "ADMIN"
        }
      });

      const passwordAccount = await prisma.account.findFirst({
        where: {
          userId: ensuredUser.id,
          password: {
            not: null
          }
        }
      });

      if (!passwordAccount) {
        warnings.push(
          `User ${ensuredUser.email} is ADMIN but has no password account. Create a new user with a fresh email to ensure password login.`
        );
      }

      seededCredentials.push({
        email: ensuredUser.email,
        password: admin.password
      });
    }

    console.log("Admin seed completed successfully.");
    console.log("Credentials:");
    for (const credentials of seededCredentials) {
      console.log(`- ${credentials.email} | ${credentials.password}`);
    }

    if (warnings.length > 0) {
      console.log("Warnings:");
      for (const warning of warnings) {
        console.log(`- ${warning}`);
      }
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

seedAdmins().catch((error) => {
  console.error("Admin seed failed.");
  console.error(error);
  process.exitCode = 1;
});
