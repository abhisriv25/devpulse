export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** One file changed in a PR, as reported by GitHub's files endpoint. Only
 * the fields the risk rules actually read. */
export interface ChangedGithubFile {
  filename: string;
  additions: number;
  deletions: number;
  status: string;
}

/**
 * Everything the pure scoring functions need, and nothing they'd have to
 * fetch themselves — assembled by risk-context.service.ts (the I/O layer)
 * so calculateRiskSignals/calculateRiskScore can stay pure functions with
 * no database or network calls of their own.
 */
export interface RiskInput {
  additions: number;
  deletions: number;
  changedFilesCount: number;
  changedFiles: ChangedGithubFile[];
}

/** One rule's verdict. `triggered: false` entries are kept (not filtered
 * out) so the stored `rulesTriggered` JSON is a complete picture of every
 * rule that ran, not just the ones that added points — useful for
 * debugging "why didn't X trigger" later. */
export interface RiskSignal {
  code: string;
  triggered: boolean;
  points: number;
  explanation: string;
  evidence: string[];
}

export interface RiskAssessmentRecord {
  id: string;
  pullRequestId: string;
  score: number;
  level: RiskLevel;
  rulesTriggered: RiskSignal[];
  engineVersion: string;
  createdAt: Date;
}
