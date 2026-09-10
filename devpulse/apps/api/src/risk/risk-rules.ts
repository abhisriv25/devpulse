import {
  DEPENDENCY_FILENAMES,
  DEPENDENCY_POINTS,
  DIFF_SIZE_BUCKETS,
  FILE_COUNT_BUCKETS,
  MIGRATION_PATH_PATTERN,
  MIGRATION_POINTS,
  NO_TEST_FILES_POINTS,
  SENSITIVE_PATH_POINTS,
  SENSITIVE_PATH_SEGMENTS,
  TEST_FILE_PATTERN,
} from "./risk-rules.config.js";
import type { ChangedGithubFile, RiskInput, RiskSignal } from "./risk.types.js";

/** True if any path segment (or the filename before its extension) is
 * exactly one of the sensitive segments — see risk-rules.config.ts for why
 * this is exact-segment rather than substring matching. */
function pathTouchesSensitiveSegment(filename: string): boolean {
  const parts = filename.toLowerCase().split("/");
  return parts.some((part) => SENSITIVE_PATH_SEGMENTS.some((seg) => part === seg || part.startsWith(`${seg}.`)));
}

function basename(filename: string): string {
  const parts = filename.split("/");
  return parts[parts.length - 1];
}

function bucketFor(value: number, buckets: { max: number; points: number }[]): number {
  const match = buckets.find((b) => value <= b.max);
  // The last bucket's max is always Infinity, so this is unreachable, but
  // TypeScript can't know that — fail loudly rather than silently scoring 0.
  if (!match) throw new Error(`No bucket matched value ${value}`);
  return match.points;
}

export function diffSizeRule(input: RiskInput): RiskSignal {
  const loc = input.additions + input.deletions;
  const points = bucketFor(loc, DIFF_SIZE_BUCKETS);
  return {
    code: "DIFF_SIZE",
    triggered: points > 0,
    points,
    explanation: `${loc} lines changed (${input.additions} added, ${input.deletions} removed)`,
    evidence: [],
  };
}

export function fileCountRule(input: RiskInput): RiskSignal {
  const count = input.changedFilesCount;
  const points = bucketFor(count, FILE_COUNT_BUCKETS);
  return {
    code: "FILE_COUNT",
    triggered: points > 0,
    points,
    explanation: `${count} file${count === 1 ? "" : "s"} changed`,
    evidence: [],
  };
}

export function sensitivePathRule(input: RiskInput): RiskSignal {
  const matched = input.changedFiles.filter((f) => pathTouchesSensitiveSegment(f.filename));
  const triggered = matched.length > 0;
  return {
    code: "SENSITIVE_PATH",
    triggered,
    points: triggered ? SENSITIVE_PATH_POINTS : 0,
    explanation: triggered
      ? "Changes touch a sensitive path (auth, payment, billing, database, infra, config, permissions, or security)"
      : "No sensitive paths touched",
    evidence: matched.map((f) => f.filename),
  };
}

export function migrationChangeRule(input: RiskInput): RiskSignal {
  const matched = input.changedFiles.filter((f) => MIGRATION_PATH_PATTERN.test(f.filename));
  const triggered = matched.length > 0;
  return {
    code: "MIGRATION_CHANGE",
    triggered,
    points: triggered ? MIGRATION_POINTS : 0,
    explanation: triggered ? "Database migration files changed" : "No migration files changed",
    evidence: matched.map((f) => f.filename),
  };
}

export function dependencyChangeRule(input: RiskInput): RiskSignal {
  const matched = input.changedFiles.filter((f) => DEPENDENCY_FILENAMES.has(basename(f.filename).toLowerCase()));
  const triggered = matched.length > 0;
  return {
    code: "DEPENDENCY_CHANGE",
    triggered,
    points: triggered ? DEPENDENCY_POINTS : 0,
    explanation: triggered ? "A dependency manifest or lockfile changed" : "No dependency files changed",
    evidence: matched.map((f) => f.filename),
  };
}

/**
 * Deliberately narrow claim: this only knows whether a test file appears
 * in *this diff*, not whether the changed code has test coverage at all.
 * A PR can be well-tested by pre-existing tests that didn't need editing.
 * The explanation text says exactly that, on purpose — "no test files
 * changed" is a much weaker (and more honest) claim than "untested", and
 * conflating the two is the kind of false precision this engine exists to
 * avoid.
 */
export function noTestFilesRule(input: RiskInput): RiskSignal {
  const hasChangedFiles = input.changedFiles.length > 0;
  const hasTestFile = input.changedFiles.some((f: ChangedGithubFile) => TEST_FILE_PATTERN.test(f.filename));
  const triggered = hasChangedFiles && !hasTestFile;
  return {
    code: "NO_TEST_FILES",
    triggered,
    points: triggered ? NO_TEST_FILES_POINTS : 0,
    explanation: triggered
      ? "No test files changed in this diff (this doesn't necessarily mean the change is untested)"
      : "Test files changed in this diff",
    evidence: [],
  };
}
