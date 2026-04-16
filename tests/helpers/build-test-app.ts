export async function buildTestApp() {
  process.env.NODE_ENV = "test";
  process.env.ADMIN_EMAILS = process.env.ADMIN_EMAILS ?? "admin@example.com";
  process.env.BETTER_AUTH_SECRET =
    process.env.BETTER_AUTH_SECRET ?? "change-this-secret-in-production-with-at-least-32-chars";
  process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3333";

  const { buildApp } = await import("../../src/interfaces/http/app");
  return buildApp();
}
