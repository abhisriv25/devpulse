import { describe, it, expect } from "vitest";
import { calculateRiskScore, calculateRiskSignals } from "./risk-engine.js";
import type { ChangedGithubFile, RiskInput } from "./risk.types.js";

function file(filename: string, overrides: Partial<ChangedGithubFile> = {}): ChangedGithubFile {
  return { filename, additions: 5, deletions: 2, status: "modified", ...overrides };
}

function input(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    additions: 10,
    deletions: 5,
    changedFilesCount: 1,
    changedFiles: [file("src/index.ts")],
    ...overrides,
  };
}

function signalFor(signals: ReturnType<typeof calculateRiskSignals>, code: string) {
  const found = signals.find((s) => s.code === code);
  if (!found) throw new Error(`No signal with code ${code}`);
  return found;
}

describe("calculateRiskSignals — diff size", () => {
  const cases: [number, number, number][] = [
    // additions, deletions, expectedPoints
    [50, 20, 0], // 70 total → bucket 1 (≤100)
    [80, 20, 0], // 100 total → still bucket 1 (max is inclusive)
    [200, 101, 10], // 301 total → bucket 3 (≤700)
    [500, 200, 10], // 700 total → still bucket 3 (max is inclusive)
    [1000, 501, 30], // 1501 total → over 1500, top bucket
  ];

  for (const [additions, deletions, expectedPoints] of cases) {
    it(`${additions + deletions} total LOC → ${expectedPoints} points`, () => {
      const signals = calculateRiskSignals(input({ additions, deletions, changedFiles: [] }));
      expect(signalFor(signals, "DIFF_SIZE").points).toBe(expectedPoints);
    });
  }

  it("exactly 100 LOC stays in the 0-point bucket (bucket max is inclusive)", () => {
    const signals = calculateRiskSignals(input({ additions: 60, deletions: 40, changedFiles: [] }));
    expect(signalFor(signals, "DIFF_SIZE").points).toBe(0);
  });

  it("101 LOC crosses into the 5-point bucket", () => {
    const signals = calculateRiskSignals(input({ additions: 101, deletions: 0, changedFiles: [] }));
    expect(signalFor(signals, "DIFF_SIZE").points).toBe(5);
  });
});

describe("calculateRiskSignals — file count", () => {
  it("5 files → 0 points, 6 files → 5 points (bucket boundary)", () => {
    const five = calculateRiskSignals(input({ changedFilesCount: 5, changedFiles: [] }));
    const six = calculateRiskSignals(input({ changedFilesCount: 6, changedFiles: [] }));
    expect(signalFor(five, "FILE_COUNT").points).toBe(0);
    expect(signalFor(six, "FILE_COUNT").points).toBe(5);
  });

  it("21+ files → the top bucket", () => {
    const signals = calculateRiskSignals(input({ changedFilesCount: 25, changedFiles: [] }));
    expect(signalFor(signals, "FILE_COUNT").points).toBe(15);
  });
});

describe("calculateRiskSignals — sensitive paths", () => {
  it("triggers on a file inside an auth/ directory, with evidence", () => {
    const signals = calculateRiskSignals(input({ changedFiles: [file("src/auth/login.ts")] }));
    const signal = signalFor(signals, "SENSITIVE_PATH");
    expect(signal.triggered).toBe(true);
    expect(signal.points).toBe(20);
    expect(signal.evidence).toEqual(["src/auth/login.ts"]);
  });

  it("does not trigger on a file that merely contains a sensitive word as a substring", () => {
    // "authors.ts" contains "auth" as a substring but is not an auth-path file.
    const signals = calculateRiskSignals(input({ changedFiles: [file("src/authors.ts")] }));
    expect(signalFor(signals, "SENSITIVE_PATH").triggered).toBe(false);
  });

  it("does not flag an unrelated config-like filename (e.g. a bundler config)", () => {
    const signals = calculateRiskSignals(input({ changedFiles: [file("webpack.config.js")] }));
    expect(signalFor(signals, "SENSITIVE_PATH").triggered).toBe(false);
  });

  it("triggers on an exact config.* filename", () => {
    const signals = calculateRiskSignals(input({ changedFiles: [file("config.yml")] }));
    expect(signalFor(signals, "SENSITIVE_PATH").triggered).toBe(true);
  });
});

describe("calculateRiskSignals — migrations", () => {
  it("triggers on a prisma migrations path", () => {
    const signals = calculateRiskSignals(
      input({ changedFiles: [file("apps/api/prisma/migrations/20260101_init/migration.sql")] })
    );
    const signal = signalFor(signals, "MIGRATION_CHANGE");
    expect(signal.triggered).toBe(true);
    expect(signal.points).toBe(15);
  });

  it("does not trigger when nothing under a migrations path changed", () => {
    const signals = calculateRiskSignals(input({ changedFiles: [file("src/index.ts")] }));
    expect(signalFor(signals, "MIGRATION_CHANGE").triggered).toBe(false);
  });
});

describe("calculateRiskSignals — dependency changes", () => {
  it("triggers on package-lock.json", () => {
    const signals = calculateRiskSignals(input({ changedFiles: [file("package-lock.json")] }));
    const signal = signalFor(signals, "DEPENDENCY_CHANGE");
    expect(signal.triggered).toBe(true);
    expect(signal.points).toBe(10);
  });

  it("does not trigger on an unrelated JSON file", () => {
    const signals = calculateRiskSignals(input({ changedFiles: [file("src/config/app.json")] }));
    expect(signalFor(signals, "DEPENDENCY_CHANGE").triggered).toBe(false);
  });
});

describe("calculateRiskSignals — test presence", () => {
  it("penalizes code changes with no test file in the diff", () => {
    const signals = calculateRiskSignals(input({ changedFiles: [file("src/index.ts")] }));
    const signal = signalFor(signals, "NO_TEST_FILES");
    expect(signal.triggered).toBe(true);
    expect(signal.points).toBe(15);
  });

  it("does not penalize when a test file is part of the diff", () => {
    const signals = calculateRiskSignals(
      input({ changedFiles: [file("src/index.ts"), file("src/index.test.ts")] })
    );
    expect(signalFor(signals, "NO_TEST_FILES").triggered).toBe(false);
  });

  it("recognizes a __tests__ directory convention", () => {
    const signals = calculateRiskSignals(
      input({ changedFiles: [file("src/index.ts"), file("src/__tests__/index.ts")] })
    );
    expect(signalFor(signals, "NO_TEST_FILES").triggered).toBe(false);
  });

  it("does not trigger when there are no changed files at all", () => {
    const signals = calculateRiskSignals(input({ changedFiles: [] }));
    expect(signalFor(signals, "NO_TEST_FILES").triggered).toBe(false);
  });
});

describe("calculateRiskScore", () => {
  it("sums every triggered rule's points correctly", () => {
    const signals = calculateRiskSignals(
      input({
        additions: 800,
        deletions: 800, // 1600 LOC → 30 points
        changedFilesCount: 12, // → 10 points
        changedFiles: [
          file("src/auth/session.ts"), // sensitive path → 20
          file("prisma/migrations/x/migration.sql"), // migration → 15
          file("package.json"), // dependency → 10
          // no test file → NO_TEST_FILES → 15
        ],
      })
    );
    // 30 + 10 + 20 + 15 + 10 + 15 = 100 (also exercises the cap, coincidentally)
    const { score } = calculateRiskScore(signals);
    expect(score).toBe(100);
  });

  it("caps the total score at 100 even when rules would sum higher", () => {
    const signals = calculateRiskSignals(
      input({
        additions: 5000,
        deletions: 5000,
        changedFilesCount: 50,
        changedFiles: [file("src/auth/x.ts"), file("prisma/migrations/y/migration.sql"), file("package.json")],
      })
    );
    const { score } = calculateRiskScore(signals);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("a small, well-tested, non-sensitive PR scores LOW", () => {
    const signals = calculateRiskSignals(
      input({
        additions: 20,
        deletions: 5,
        changedFilesCount: 2,
        changedFiles: [file("src/util.ts"), file("src/util.test.ts")],
      })
    );
    const { score, level } = calculateRiskScore(signals);
    expect(score).toBe(0);
    expect(level).toBe("LOW");
  });

  for (const [score, expectedLevel] of [
    [0, "LOW"],
    [24, "LOW"],
    [25, "MEDIUM"],
    [49, "MEDIUM"],
    [50, "HIGH"],
    [74, "HIGH"],
    [75, "CRITICAL"],
    [100, "CRITICAL"],
  ] as const) {
    it(`a raw score of ${score} maps to level ${expectedLevel}`, () => {
      // Construct signals that sum to exactly `score` by using a single
      // synthetic signal rather than fighting the real rule thresholds.
      const { level } = calculateRiskScore([
        { code: "TEST", triggered: score > 0, points: score, explanation: "", evidence: [] },
      ]);
      expect(level).toBe(expectedLevel);
    });
  }
});
