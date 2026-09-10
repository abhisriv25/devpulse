import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../embeddings/embedding-provider.js", () => ({
  generateEmbeddings: vi.fn(),
}));

vi.mock("./retrieval.repository.js", () => ({
  searchSimilarChunks: vi.fn(),
}));

import { generateEmbeddings } from "../embeddings/embedding-provider.js";
import { searchSimilarChunks } from "./retrieval.repository.js";
import { retrieveRelevantContext } from "./retrieval.service.js";

const mockedGenerate = vi.mocked(generateEmbeddings);
const mockedSearch = vi.mocked(searchSimilarChunks);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("retrieveRelevantContext", () => {
  it("returns an empty array for a blank query without embedding or searching anything", async () => {
    const result = await retrieveRelevantContext({ organizationId: "org_1", query: "   " });
    expect(result).toEqual([]);
    expect(mockedGenerate).not.toHaveBeenCalled();
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("embeds the query then searches with the org id and default topK", async () => {
    mockedGenerate.mockResolvedValue({ vectors: [[0.1, 0.2]], model: "text-embedding-3-small", dimensions: 2 });
    mockedSearch.mockResolvedValue([]);

    await retrieveRelevantContext({ organizationId: "org_1", query: "cache invalidation policy" });

    expect(mockedGenerate).toHaveBeenCalledWith(["cache invalidation policy"]);
    expect(mockedSearch).toHaveBeenCalledWith("org_1", [0.1, 0.2], 5);
  });

  it("respects a custom topK", async () => {
    mockedGenerate.mockResolvedValue({ vectors: [[0.1]], model: "m", dimensions: 1 });
    mockedSearch.mockResolvedValue([]);

    await retrieveRelevantContext({ organizationId: "org_1", query: "q", topK: 2 });

    expect(mockedSearch).toHaveBeenCalledWith("org_1", [0.1], 2);
  });

  it("returns whatever the search layer returns, unmodified", async () => {
    mockedGenerate.mockResolvedValue({ vectors: [[0.1]], model: "m", dimensions: 1 });
    const chunks = [
      {
        chunkId: "c1",
        documentId: "d1",
        content: "text",
        heading: null,
        path: "README.md",
        title: null,
        similarity: 0.9,
      },
    ];
    mockedSearch.mockResolvedValue(chunks);

    const result = await retrieveRelevantContext({ organizationId: "org_1", query: "q" });
    expect(result).toBe(chunks);
  });
});
