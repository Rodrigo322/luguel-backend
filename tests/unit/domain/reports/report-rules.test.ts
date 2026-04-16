import { describe, expect, it } from "vitest";
import { classifyReportRisk, ensureReportHasValidTarget } from "../../../../src/domain/reports/services/report-rules";

describe("report-rules", () => {
  it("should require listing or rental target", () => {
    expect(() => ensureReportHasValidTarget({})).toThrowError(/must target listing or rental/);
  });

  it("should classify risks by keywords", () => {
    expect(classifyReportRisk("golpe confirmado")).toBe("CRITICAL");
    expect(classifyReportRisk("abuso verbal")) .toBe("HIGH");
    expect(classifyReportRisk("spam suspeito")).toBe("MEDIUM");
    expect(classifyReportRisk("atraso simples")).toBe("LOW");
  });
});
