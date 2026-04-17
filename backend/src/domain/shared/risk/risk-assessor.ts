import type { RiskAssessmentResult } from "./risk-level";

interface AssessListingRiskInput {
  title: string;
  description: string;
  dailyPrice: number;
  ownerReputationScore: number;
}

const suspiciousKeywords = [
  "pix",
  "adiantado",
  "whatsapp",
  "fora da plataforma",
  "crypto"
];

export function assessListingRisk(input: AssessListingRiskInput): RiskAssessmentResult {
  const reasons: string[] = [];
  let score = 0;

  const content = `${input.title} ${input.description}`.toLowerCase();

  for (const keyword of suspiciousKeywords) {
    if (content.includes(keyword)) {
      score += 18;
      reasons.push(`Suspicious keyword found: ${keyword}`);
    }
  }

  if (input.dailyPrice >= 10000) {
    score += 45;
    reasons.push("Unusually high daily price.");
  } else if (input.dailyPrice >= 5000) {
    score += 25;
    reasons.push("Elevated daily price.");
  }

  if (input.ownerReputationScore < 10) {
    score += 30;
    reasons.push("Owner has very low reputation.");
  } else if (input.ownerReputationScore < 30) {
    score += 15;
    reasons.push("Owner has medium reputation risk.");
  }

  if (input.description.trim().length < 30) {
    score += 10;
    reasons.push("Listing description is too short.");
  }

  if (score >= 80) {
    return { score, level: "CRITICAL", reasons };
  }

  if (score >= 55) {
    return { score, level: "HIGH", reasons };
  }

  if (score >= 30) {
    return { score, level: "MEDIUM", reasons };
  }

  return { score, level: "LOW", reasons };
}
