export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAssessmentResult {
  score: number;
  level: RiskLevel;
  reasons: string[];
}
