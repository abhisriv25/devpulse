import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./pr-analysis.service.js", () => ({
  PullRequestNotFoundError: class PullRequestNotFoundError extends Error {},
  RepositoryNotFoundError: class RepositoryNotFoundError extends Error {},
  analyzePullRequest: vi.fn(),
}));

vi.mock("./pr-intelligence.repository.js", () => ({
  createPrIntelligence: vi.fn(),
  findLatestPrIntelligence: vi.fn(),
}));

// pr-intelligence.service.ts imports RETRIEVAL_VERSION from the real
// retrieval.service.js, whose module graph reaches db/client.js — mock it
// directly so this test file never triggers a real PrismaClient()
// construction (same reasoning as every other raw-SQL-adjacent test file).
vi.mock("../retrieval/retrieval.service.js", () => ({
  RETRIEVAL_VERSION: "v1",
}));

import { analyzePullRequest } from "./pr-analysis.service.js";
import { createPrIntelligence, findLatestPrIntelligence } from "./pr-intelligence.repository.js";
import { getOrCreatePrIntelligence } from "./pr-intelligence.service.js";

const mockedAnalyze = vi.mocked(analyzePullRequest);
const mockedCreate = vi.mocked(createPrIntelligence);
const mockedFindLatest = vi.mocked(findLatestPrIntelligence);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrCreatePrIntelligence", () => {
  it("returns an existing persisted analysis without calling Slice 9 again", async () => {
    mockedFindLatest.mockResolvedValue({ id: "pra_1" } as never);

    const result = await getOrCreatePrIntelligence("pr_1");

    expect(result).toEqual({ status: "analyzed", intelligence: { id: "pra_1" } });
    expect(mockedAnalyze).not.toHaveBeenCalled();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("passes through a LOW-risk skip without persisting anything", async () => {
    mockedFindLatest.mockResolvedValue(null);
    mockedAnalyze.mockResolvedValue({ status: "skipped_low_risk", score: 10, level: "LOW" } as never);

    const result = await getOrCreatePrIntelligence("pr_1");

    expect(result).toEqual({ status: "skipped_low_risk", score: 10, level: "LOW" });
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("persists a new record with every version stamp when Slice 9 produces an analysis", async () => {
    mockedFindLatest.mockResolvedValue(null);
    mockedAnalyze.mockResolvedValue({
      status: "analyzed",
      model: "gpt-4o",
      riskAssessmentId: "assessment_1",
      score: 65,
      level: "HIGH",
      analysis: {
        summary: "Notable caching risk.",
        riskExplanation: [{ title: "Large diff", severity: "HIGH", reason: "r", evidence: [] }],
        recommendations: [{ action: "Add tests", reason: "r", source: "docs/caching.md" }],
        confidence: "MEDIUM",
      },
    } as never);
    mockedCreate.mockResolvedValue({ id: "pra_new" } as never);

    const result = await getOrCreatePrIntelligence("pr_1");

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        pullRequestId: "pr_1",
        riskAssessmentId: "assessment_1",
        deterministicScore: 65,
        riskLevel: "HIGH",
        summary: "Notable caching risk.",
        confidence: "MEDIUM",
        llmModel: "gpt-4o",
        riskEngineVersion: expect.any(String),
        promptVersion: expect.any(String),
        retrievalVersion: expect.any(String),
      })
    );
    expect(result).toEqual({ status: "analyzed", intelligence: { id: "pra_new" } });
  });

  it("propagates errors from analyzePullRequest (e.g. PR not found) without persisting", async () => {
    mockedFindLatest.mockResolvedValue(null);
    mockedAnalyze.mockRejectedValue(new Error("PullRequest not found"));

    await expect(getOrCreatePrIntelligence("pr_missing")).rejects.toThrow("PullRequest not found");
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});
