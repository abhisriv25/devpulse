import type { RiskLevel } from "./risk.types.js";

/**
 * Every threshold and point value below is a **product decision**, not a
 * derived or scientifically-validated fact — see the risk engine's own
 * design notes on this. They live in one file, named and commented, so
 * they're visibly tunable rather than magic numbers buried in rule logic.
 * Changing any of these is a product change; bump RISK_ENGINE_VERSION when
 * you do, so a score change is traceable to "the engine changed" instead
 * of looking like a bug.
 */
export const RISK_ENGINE_VERSION = "v1";

export const MAX_SCORE = 100;

/** Diff size (additions + deletions), bucketed. `max` is inclusive. */
export const DIFF_SIZE_BUCKETS: { max: number; points: number }[] = [
  { max: 100, points: 0 },
  { max: 300, points: 5 },
  { max: 700, points: 10 },
  { max: 1500, points: 20 },
  { max: Infinity, points: 30 },
];

/** Number of files changed, bucketed. `max` is inclusive. */
export const FILE_COUNT_BUCKETS: { max: number; points: number }[] = [
  { max: 5, points: 0 },
  { max: 10, points: 5 },
  { max: 20, points: 10 },
  { max: Infinity, points: 15 },
];

/** A file "touches a sensitive path" if any path segment, or the filename
 * itself (before its extension), exactly matches one of these — e.g.
 * `src/auth/login.ts` and `config.yml` both match, but `authors.ts` and
 * `webpack.config.js` don't. Deliberately exact-segment matching rather
 * than substring matching, to avoid flagging unrelated files that merely
 * contain one of these words. */
export const SENSITIVE_PATH_SEGMENTS = [
  "auth",
  "payment",
  "billing",
  "database",
  "infra",
  "config",
  "permissions",
  "security",
];
export const SENSITIVE_PATH_POINTS = 20;

/** Any path with a `migration`/`migrations` segment — covers
 * `prisma/migrations/*`, `db/migrate/*`, `migrations/*`, etc. — without
 * hardcoding one framework's convention. */
export const MIGRATION_PATH_PATTERN = /(^|\/)migrations?(\/|$)/i;
export const MIGRATION_POINTS = 15;

/** Dependency manifests/lockfiles across the ecosystems this is likely to
 * see. Matched on the filename only (not full path), case-insensitive. */
export const DEPENDENCY_FILENAMES = new Set([
  "package.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "requirements.txt",
  "pipfile",
  "pipfile.lock",
  "go.mod",
  "go.sum",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "cargo.toml",
  "cargo.lock",
]);
export const DEPENDENCY_POINTS = 10;

/** Matches common test-file conventions: a `test`/`tests`/`__tests__`
 * directory, or a `.test.`/`.spec.` filename segment (any language's
 * common runner conventions), or a `test_`/`_test` Python-style name. */
export const TEST_FILE_PATTERN =
  /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[a-z0-9]+$|(^|\/)test_[^/]+$|_test\.[a-z0-9]+$/i;
export const NO_TEST_FILES_POINTS = 15;

/** Severity bands. Checked from highest to lowest; a score qualifies for
 * the first band whose `min` it meets or exceeds. */
export const RISK_LEVEL_THRESHOLDS: { level: RiskLevel; min: number }[] = [
  { level: "CRITICAL", min: 75 },
  { level: "HIGH", min: 50 },
  { level: "MEDIUM", min: 25 },
  { level: "LOW", min: 0 },
];
