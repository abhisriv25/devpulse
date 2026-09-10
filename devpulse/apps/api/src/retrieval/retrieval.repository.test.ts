import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/client.js", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

import { prisma } from "../db/client.js";
import { searchSimilarChunks } from "./retrieval.repository.js";

const mockedQueryRaw = vi.mocked(prisma.$queryRaw);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchSimilarChunks", () => {
  it("includes the organization id in the query — the tenant-isolation contract", async () => {
    mockedQueryRaw.mockResolvedValue([]);

    await searchSimilarChunks("org_mine", [0.1, 0.2], 5);

    const values = mockedQueryRaw.mock.calls[0].slice(1);
    expect(values).toContain("org_mine");
  });

  it("passes topK and the vector literal through to the query", async () => {
    mockedQueryRaw.mockResolvedValue([]);

    await searchSimilarChunks("org_mine", [0.1, 0.2, 0.3], 7);

    const values = mockedQueryRaw.mock.calls[0].slice(1);
    expect(values).toContain(7);
    expect(values).toContain("[0.1,0.2,0.3]");
  });

  it("maps raw rows into RetrievedChunk, pulling heading out of metadata", async () => {
    mockedQueryRaw.mockResolvedValue([
      {
        chunkId: "chunk_1",
        documentId: "doc_1",
        content: "some text",
        metadata: { heading: "Cache invalidation" },
        path: "docs/caching.md",
        title: "Caching guidelines",
        similarity: 0.87,
      },
    ]);

    const result = await searchSimilarChunks("org_mine", [0.1], 5);

    expect(result).toEqual([
      {
        chunkId: "chunk_1",
        documentId: "doc_1",
        content: "some text",
        heading: "Cache invalidation",
        path: "docs/caching.md",
        title: "Caching guidelines",
        similarity: 0.87,
      },
    ]);
  });

  it("defaults heading to null when a chunk has no heading metadata", async () => {
    mockedQueryRaw.mockResolvedValue([
      {
        chunkId: "chunk_1",
        documentId: "doc_1",
        content: "text",
        metadata: { heading: null },
        path: "README.md",
        title: null,
        similarity: 0.5,
      },
    ]);

    const result = await searchSimilarChunks("org_mine", [0.1], 5);
    expect(result[0].heading).toBeNull();
  });

  it("returns an empty array when nothing matches, without throwing", async () => {
    mockedQueryRaw.mockResolvedValue([]);
    const result = await searchSimilarChunks("org_mine", [0.1], 5);
    expect(result).toEqual([]);
  });
});
