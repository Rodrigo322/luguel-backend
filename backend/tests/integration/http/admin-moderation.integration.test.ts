import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Admin moderation", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should update user role, moderate listing and handle reports", async () => {
    const ownerSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner Moderation",
      email: "owner-moderation@example.com",
      password: "StrongPass123!"
    });

    const ownerCookie = ownerSignup.headers["set-cookie"];
    const ownerId = ownerSignup.body.user.id as string;

    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerCookie).send({ role: "LOCADOR" });

    const listingCreate = await request(app.server).post("/api/v1/listings").set("Cookie", ownerCookie).send({
      title: "Item moderacao",
      description: "Descricao de anuncio para fluxo administrativo completo.",
      dailyPrice: 220
    });

    const listingId = listingCreate.body.listing.id as string;

    const tenantSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Tenant Moderation",
      email: "tenant-moderation@example.com",
      password: "StrongPass123!"
    });

    const tenantCookie = tenantSignup.headers["set-cookie"];

    const reportCreate = await request(app.server).post("/api/v1/reports").set("Cookie", tenantCookie).send({
      listingId,
      reason: "spam suspeito no anuncio",
      details: "Possivel fraude"
    });

    expect(reportCreate.statusCode).toBe(201);
    const reportId = reportCreate.body.id as string;

    const adminSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Admin Moderation",
      email: "admin@example.com",
      password: "StrongPass123!"
    });

    const adminCookie = adminSignup.headers["set-cookie"];

    const updateRole = await request(app.server)
      .patch(`/api/v1/admin/users/${tenantSignup.body.user.id as string}/role`)
      .set("Cookie", adminCookie)
      .send({ role: "LOCADOR" });

    expect(updateRole.statusCode).toBe(200);
    expect(updateRole.body.role).toBe("LOCADOR");

    const rejectListing = await request(app.server)
      .post(`/api/v1/admin/listings/${listingId}/reject`)
      .set("Cookie", adminCookie)
      .send({ reason: "Conteudo em revisao moderadora." });

    expect(rejectListing.statusCode).toBe(200);
    expect(rejectListing.body.status).toBe("SUSPENDED");

    const approveListing = await request(app.server)
      .post(`/api/v1/admin/listings/${listingId}/approve`)
      .set("Cookie", adminCookie)
      .send();

    expect(approveListing.statusCode).toBe(200);
    expect(approveListing.body.status).toBe("ACTIVE");

    const banUser = await request(app.server)
      .post(`/api/v1/admin/users/${ownerId}/ban`)
      .set("Cookie", adminCookie)
      .send({ reason: "Violacao repetida de politica." });

    expect(banUser.statusCode).toBe(200);
    expect(banUser.body.isBanned).toBe(true);

    const ownerCreateBlocked = await request(app.server).post("/api/v1/listings").set("Cookie", ownerCookie).send({
      title: "Novo anuncio bloqueado",
      description: "Descricao que deveria ser bloqueada por banimento do usuario.",
      dailyPrice: 150
    });

    expect(ownerCreateBlocked.statusCode).toBe(403);

    const reviewReportStatus = await request(app.server)
      .patch(`/api/v1/admin/reports/${reportId}/status`)
      .set("Cookie", adminCookie)
      .send({ status: "TRIAGED", reason: "Triagem inicial concluida." });

    expect(reviewReportStatus.statusCode).toBe(200);
    expect(reviewReportStatus.body.status).toBe("TRIAGED");

    const archiveListing = await request(app.server)
      .post(`/api/v1/admin/listings/${listingId}/archive`)
      .set("Cookie", adminCookie)
      .send({ reason: "Remocao administrativa por moderacao." });

    expect(archiveListing.statusCode).toBe(200);
    expect(archiveListing.body.status).toBe("ARCHIVED");
  });
});
