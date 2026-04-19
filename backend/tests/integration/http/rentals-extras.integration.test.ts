import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../../helpers/build-test-app";

describe("Rentals extras (payment, contract, receipt and chat)", () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should handle split payment flow, digital contract and internal chat", async () => {
    const ownerSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Owner Extras",
      email: "owner-extras@example.com",
      password: "StrongPass123!"
    });
    const ownerCookie = ownerSignup.headers["set-cookie"];

    await request(app.server).patch("/api/v1/users/me/role").set("Cookie", ownerCookie).send({ role: "LOCADOR" });

    const listingCreate = await request(app.server).post("/api/v1/listings").set("Cookie", ownerCookie).send({
      title: "Camera 8K",
      description: "Equipamento premium com contrato digital e entrega flexivel para locacao segura.",
      dailyPrice: 100
    });

    expect(listingCreate.statusCode).toBe(201);
    const listingId = listingCreate.body.listing.id as string;

    const tenantSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Tenant Extras",
      email: "tenant-extras@example.com",
      password: "StrongPass123!"
    });
    const tenantCookie = tenantSignup.headers["set-cookie"];

    const rentalCreate = await request(app.server).post("/api/v1/rentals").set("Cookie", tenantCookie).send({
      listingId,
      startDate: new Date("2026-08-10T00:00:00.000Z").toISOString(),
      endDate: new Date("2026-08-14T00:00:00.000Z").toISOString(),
      paymentMode: "SPLIT_SIGNAL_REMAINDER",
      depositAmount: 50,
      signalAmount: 120,
      fulfillmentMethod: "DELIVERY_OWNER",
      deliveryAddress: "Rua de Teste 123, Centro"
    });

    expect(rentalCreate.statusCode).toBe(201);
    const rentalId = rentalCreate.body.id as string;
    expect(rentalCreate.body.fulfillmentMethod).toBe("DELIVERY_OWNER");
    expect(rentalCreate.body.deliveryAddress).toBe("Rua de Teste 123, Centro");

    const paymentGet = await request(app.server)
      .get(`/api/v1/rentals/${rentalId}/payment`)
      .set("Cookie", tenantCookie);

    expect(paymentGet.statusCode).toBe(200);
    expect(paymentGet.body.totalAmount).toBe(450);
    expect(paymentGet.body.signalAmount).toBe(120);
    expect(paymentGet.body.remainderAmount).toBe(330);
    expect(paymentGet.body.status).toBe("PENDING");

    const partialPayment = await request(app.server)
      .post(`/api/v1/rentals/${rentalId}/payment/confirm`)
      .set("Cookie", tenantCookie)
      .send({
        amount: 120,
        inAppPaymentReference: "PAY-SIGNAL-001"
      });

    expect(partialPayment.statusCode).toBe(200);
    expect(partialPayment.body.payment.status).toBe("PARTIALLY_PAID");
    expect(partialPayment.body.receipt).toBeUndefined();

    const fullPayment = await request(app.server)
      .post(`/api/v1/rentals/${rentalId}/payment/confirm`)
      .set("Cookie", ownerCookie)
      .send({
        amount: 330,
        proofUrl: "https://example.com/comprovante.png"
      });

    expect(fullPayment.statusCode).toBe(200);
    expect(fullPayment.body.payment.status).toBe("PAID");
    expect(fullPayment.body.receipt).toBeDefined();
    expect(fullPayment.body.receipt.rentalId).toBe(rentalId);

    const receiptGet = await request(app.server)
      .get(`/api/v1/rentals/${rentalId}/receipt`)
      .set("Cookie", tenantCookie);

    expect(receiptGet.statusCode).toBe(200);
    expect(receiptGet.body.receiptNumber).toContain("LUG-");

    const contractGet = await request(app.server)
      .get(`/api/v1/rentals/${rentalId}/contract`)
      .set("Cookie", tenantCookie);

    expect(contractGet.statusCode).toBe(200);
    expect(contractGet.body.checksum).toHaveLength(64);

    const contractTenantAccept = await request(app.server)
      .post(`/api/v1/rentals/${rentalId}/contract/accept`)
      .set("Cookie", tenantCookie);

    expect(contractTenantAccept.statusCode).toBe(200);
    expect(contractTenantAccept.body.acceptedByTenantAt).toBeDefined();

    const contractOwnerAccept = await request(app.server)
      .post(`/api/v1/rentals/${rentalId}/contract/accept`)
      .set("Cookie", ownerCookie);

    expect(contractOwnerAccept.statusCode).toBe(200);
    expect(contractOwnerAccept.body.acceptedByOwnerAt).toBeDefined();

    const adminSignup = await request(app.server).post("/api/v1/auth/signup").send({
      name: "Admin Extras",
      email: "admin@example.com",
      password: "StrongPass123!"
    });
    const adminCookie = adminSignup.headers["set-cookie"];

    const contractAdminAccept = await request(app.server)
      .post(`/api/v1/rentals/${rentalId}/contract/accept`)
      .set("Cookie", adminCookie);

    expect(contractAdminAccept.statusCode).toBe(403);

    const chatSendTenant = await request(app.server)
      .post(`/api/v1/rentals/${rentalId}/chat/messages`)
      .set("Cookie", tenantCookie)
      .send({ message: "Mensagem inicial da locacao." });

    expect(chatSendTenant.statusCode).toBe(201);

    const chatSendOwner = await request(app.server)
      .post(`/api/v1/rentals/${rentalId}/chat/messages`)
      .set("Cookie", ownerCookie)
      .send({ message: "Confirmado. Item pronto para entrega." });

    expect(chatSendOwner.statusCode).toBe(201);

    const chatList = await request(app.server)
      .get(`/api/v1/rentals/${rentalId}/chat/messages`)
      .set("Cookie", tenantCookie);

    expect(chatList.statusCode).toBe(200);
    expect(chatList.body.messages).toHaveLength(2);
    expect(chatList.body.messages[0].message).toContain("Mensagem inicial");
    expect(chatList.body.messages[1].message).toContain("Item pronto para entrega");
  });
});
