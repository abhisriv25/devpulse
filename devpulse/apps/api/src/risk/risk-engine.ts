import { MAX_SCORE, RISK_LEVEL_THRESHOLDS } from "./risk-rules.config.js";
import {
  dependencyChangeRule,
  diffSizeRule,
  fileCountRule,
  migrationChangeRule,
  noTestFilesRule,
  sensitivePathRule,
} from "./risk-rules.js";
import type { RiskInput, RiskLevel, RiskSignal } from "./risk.types.js";

/**
 * The complete Slice 5 rule set — six signals, all it takes to produce a
 * defensible, explainable score. Deliberately not forty rules: each of
 * these maps to a real "does this PR deserve extra attention" question
 * (how much changed, where, is it tested, does it touch dependencies or
 * migrations), and a small, well-tested set beats a sprawling one that's
 * hard to reason about or trust.
 *
 * Pure function: no database calls, no network calls, no side effects.
 * Everything it needs is already in `input` — see risk-context.service.ts
 * for how that gets assembled. That separation is what makes this
 * trivially unit-testable and safe to re-run without re-fetching anything.
 */
export function calculateRiskSignals(input: RiskInput): RiskSignal[] {
  return [
    diffSizeRule(input),
    fileCountRule(input),
    sensitivePathRule(input),
    migrationChangeRule(input),
    dependencyChangeRule(input),
    noTestFilesRule(input),
  ];
}

/**
 * Sums triggered signals' points, caps at MAX_SCORE, and maps the result
 * to a severity band. Also pure — same reasoning as calculateRiskSignals.
 */
export function calculateRiskScore(signals: RiskSignal[]): { score: number; level: RiskLevel } {
  const rawScore = signals.reduce((sum, signal) => sum + signal.points, 0);
  const score = Math.min(rawScore, MAX_SCORE);

  const band = RISK_LEVEL_THRESHOLDS.find((t) => score >= t.min);
  // RISK_LEVEL_THRESHOLDS always includes a { min: 0 } band, so this can
  // never actually be undefined for a non-negative score — but fail loudly
  // rather than silently mislabeling if that invariant ever breaks.
  if (!band) throw new Error(`No risk level band matched score ${score}`);

  return { score, level: band.level };
}
