import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Admin reports listing", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should list reports with filters and pagination for admin", async () => {
    const ownerSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner Reports",
      email: "owner-reports@example.com",
      password: "StrongPass123!"
    });
    const ownerCookie = ownerSignup.headers["set-cookie"];
    const ownerId = ownerSignup.body.user.id as string;

    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerCookie).send({ role: "LOCADOR" });

    const listingCreate = await request(app.server).post("/api/v1/listings").set("Cookie", ownerCookie).send({
      title: "Item para reports admin",
      description: "Descricao detalhada para validar listagem administrativa de denuncias.",
      dailyPrice: 210
    });
    const listingId = listingCreate.body.listing.id as string;

    const tenantSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Tenant Reports",
      email: "tenant-reports@example.com",
      password: "StrongPass123!"
    });
    const tenantCookie = tenantSignup.headers["set-cookie"];

    const criticalReport = await request(app.server).post("/api/v1/reports").set("Cookie", tenantCookie).send({
      listingId,
      reason: "Fraude detectada no anuncio",
      details: "golpe confirmado em negociacao externa"
    });
    expect(criticalReport.statusCode).toBe(201);

    const mediumReport = await request(app.server).post("/api/v1/reports").set("Cookie", tenantCookie).send({
      listingId,
      reason: "Spam suspeito",
      details: "mensagens repetidas e suspeitas"
    });
    expect(mediumReport.statusCode).toBe(201);

    const highReport = await request(app.server).post("/api/v1/reports").set("Cookie", tenantCookie).send({
      listingId,
      reason: "Abuso verbal",
      details: "conduta ofensiva recorrente"
    });
    expect(highReport.statusCode).toBe(201);

    const adminSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Admin Reports",
      email: "admin@example.com",
      password: "StrongPass123!"
    });
    const adminCookie = adminSignup.headers["set-cookie"];

    const pagedList = await request(app.server)
      .get("/api/v1/admin/reports?page=1&pageSize=2")
      .set("Cookie", adminCookie);

    expect(pagedList.statusCode).toBe(200);
    expect(pagedList.body.reports).toHaveLength(2);
    expect(pagedList.body.pagination.total).toBe(3);
    expect(pagedList.body.pagination.totalPages).toBe(2);

    const criticalOnly = await request(app.server)
      .get("/api/v1/admin/reports?riskLevel=CRITICAL")
      .set("Cookie", adminCookie);

    expect(criticalOnly.statusCode).toBe(200);
    expect(criticalOnly.body.reports).toHaveLength(1);
    expect(criticalOnly.body.reports[0].riskLevel).toBe("CRITICAL");
    expect(criticalOnly.body.reports[0].subjectUserId).toBe(ownerId);

    const triage = await request(app.server)
      .patch(`/api/v1/admin/reports/${criticalReport.body.id as string}/status`)
      .set("Cookie", adminCookie)
      .send({
        status: "TRIAGED",
        reason: "Caso triado para revisao"
      });

    expect(triage.statusCode).toBe(200);

    const triagedOnly = await request(app.server)
      .get("/api/v1/admin/reports?status=TRIAGED")
      .set("Cookie", adminCookie);

    expect(triagedOnly.statusCode).toBe(200);
    expect(triagedOnly.body.reports).toHaveLength(1);
    expect(triagedOnly.body.reports[0].status).toBe("TRIAGED");
  });
});
