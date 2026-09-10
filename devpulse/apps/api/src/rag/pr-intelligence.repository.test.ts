import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/client.js", () => ({
  prisma: {
    pRAnalysis: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "../db/client.js";
import { createPrIntelligence, findLatestPrIntelligence } from "./pr-intelligence.repository.js";

const mockedCreate = vi.mocked(prisma.pRAnalysis.create);
const mockedFindFirst = vi.mocked(prisma.pRAnalysis.findFirst);

const INPUT = {
  pullRequestId: "pr_1",
  riskAssessmentId: "assessment_1",
  deterministicScore: 65,
  riskLevel: "HIGH" as const,
  summary: "Notable caching risk.",
  findings: [],
  recommendations: [],
  confidence: "MEDIUM" as const,
  riskEngineVersion: "v1",
  promptVersion: "v1",
  embeddingModel: "text-embedding-3-small",
  retrievalVersion: "v1",
  llmModel: "gpt-4o",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPrIntelligence", () => {
  it("writes every field, including all four version stamps", async () => {
    mockedCreate.mockResolvedValue({} as never);

    await createPrIntelligence(INPUT);

    const call = mockedCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).toMatchObject({
      pullRequestId: "pr_1",
      riskAssessmentId: "assessment_1",
      deterministicScore: 65,
      riskLevel: "HIGH",
      summary: "Notable caching risk.",
      confidence: "MEDIUM",
      riskEngineVersion: "v1",
      promptVersion: "v1",
      embeddingModel: "text-embedding-3-small",
      retrievalVersion: "v1",
      llmModel: "gpt-4o",
    });
  });

  it("accepts a null embeddingModel", async () => {
    mockedCreate.mockResolvedValue({} as never);

    await createPrIntelligence({ ...INPUT, embeddingModel: null });

    const call = mockedCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.embeddingModel).toBeNull();
  });
});

describe("findLatestPrIntelligence", () => {
  it("returns the newest record for the PR", async () => {
    mockedFindFirst.mockResolvedValue({ id: "pra_1" } as never);

    const result = await findLatestPrIntelligence("pr_1");

    expect(result).toEqual({ id: "pra_1" });
    const call = mockedFindFirst.mock.calls[0][0] as { where: unknown; orderBy: unknown };
    expect(call.where).toEqual({ pullRequestId: "pr_1" });
    expect(call.orderBy).toEqual({ createdAt: "desc" });
  });

  it("returns null when nothing exists yet", async () => {
    mockedFindFirst.mockResolvedValue(null);
    expect(await findLatestPrIntelligence("pr_1")).toBeNull();
  });
});
