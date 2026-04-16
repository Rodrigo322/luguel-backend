import { beforeEach, describe, expect, it } from "vitest";
import { createBoost } from "../../../../src/application/boost/create-boost";
import {
  createListingRecord,
  resetInMemoryStore,
  upsertUserFromAuth
} from "../../../../src/infra/persistence/in-memory-store";

describe("createBoost", () => {
  beforeEach(async () => {
    await resetInMemoryStore();
  });

  it("should reject boost when payment is not confirmed", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-boost-unit",
      email: "owner-boost-unit@example.com",
      name: "Owner Boost Unit"
    });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Casa boost",
      description: "Descricao valida para locacao.",
      dailyPrice: 190,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    await expect(
      createBoost({
        requesterId: owner.id,
        listingId: listing.id,
        amount: 99.9,
        days: 7,
        paymentConfirmed: false
      })
    ).rejects.toMatchObject({
      code: "PaymentRequired"
    });
  });

  it("should reject boost when requester is not owner nor admin", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-boost-forbidden",
      email: "owner-boost-forbidden@example.com",
      name: "Owner Boost Forbidden"
    });
    const otherUser = await upsertUserFromAuth({
      id: "other-boost-forbidden",
      email: "other-boost-forbidden@example.com",
      name: "Other Boost Forbidden"
    });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Casa boost 2",
      description: "Descricao valida para locacao.",
      dailyPrice: 210,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    await expect(
      createBoost({
        requesterId: otherUser.id,
        listingId: listing.id,
        amount: 100,
        days: 3,
        paymentConfirmed: true
      })
    ).rejects.toMatchObject({
      code: "BoostForbidden"
    });
  });

  it("should create an active boost for owner with valid payment", async () => {
    const owner = await upsertUserFromAuth({
      id: "owner-boost-ok",
      email: "owner-boost-ok@example.com",
      name: "Owner Boost Ok"
    });

    const listing = await createListingRecord({
      ownerId: owner.id,
      title: "Casa boost ok",
      description: "Descricao valida para locacao.",
      dailyPrice: 250,
      status: "ACTIVE",
      riskLevel: "LOW"
    });

    const boost = await createBoost({
      requesterId: owner.id,
      listingId: listing.id,
      amount: 159.5,
      days: 10,
      paymentConfirmed: true
    });

    expect(boost.status).toBe("ACTIVE");
    expect(boost.amount).toBe(159.5);
  });
});
