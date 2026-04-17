import { describe, expect, it } from "vitest";
import { assessListingRisk } from "../../../../src/domain/shared/risk/risk-assessor";

describe("Listing risk assessor", () => {
  it("should classify low risk listing", () => {
    const result = assessListingRisk({
      title: "Apartamento mobiliado em bairro central",
      description:
        "Apartamento com contrato padrão, visita agendada e pagamento somente pela plataforma.",
      dailyPrice: 180,
      ownerReputationScore: 60
    });

    expect(result.level).toBe("LOW");
    expect(result.score).toBeLessThan(30);
  });

  it("should classify critical risk listing with suspicious signals", () => {
    const result = assessListingRisk({
      title: "Casa premium pagamento pix adiantado",
      description: "Negocio direto whatsapp, pagamento pix e crypto sem plataforma.",
      dailyPrice: 12000,
      ownerReputationScore: 2
    });

    expect(result.level).toBe("CRITICAL");
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
