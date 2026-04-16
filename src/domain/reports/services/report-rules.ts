import { DomainError } from "../../shared/errors/domain-error";
import type { RiskLevel } from "../../shared/risk/risk-level";

export function ensureReportHasValidTarget(input: {
  listingId?: string;
  rentalId?: string;
}): void {
  if (!input.listingId && !input.rentalId) {
    throw new DomainError("Report must target listing or rental.", 400, "InvalidReportTarget");
  }
}

export function classifyReportRisk(reason: string, details?: string): RiskLevel {
  const content = `${reason} ${details ?? ""}`.toLowerCase();

  if (content.includes("golpe") || content.includes("fraude") || content.includes("amea")) {
    return "CRITICAL";
  }

  if (content.includes("abuso") || content.includes("discrimina") || content.includes("extors")) {
    return "HIGH";
  }

  if (content.includes("spam") || content.includes("suspeito")) {
    return "MEDIUM";
  }

  return "LOW";
}
