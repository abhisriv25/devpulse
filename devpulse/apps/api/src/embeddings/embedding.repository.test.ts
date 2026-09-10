import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/client.js", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

import { prisma } from "../db/client.js";
import { findChunksNeedingEmbedding, saveEmbedding } from "./embedding.repository.js";

const mockedQueryRaw = vi.mocked(prisma.$queryRaw);
const mockedExecuteRaw = vi.mocked(prisma.$executeRaw);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findChunksNeedingEmbedding", () => {
  it("returns whatever rows the query yields", async () => {
    mockedQueryRaw.mockResolvedValue([{ id: "chunk_1", content: "hello" }]);

    const result = await findChunksNeedingEmbedding("text-embedding-3-small", 10);

    expect(result).toEqual([{ id: "chunk_1", content: "hello" }]);
    expect(mockedQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("passes the current model and limit into the query", async () => {
    mockedQueryRaw.mockResolvedValue([]);

    await findChunksNeedingEmbedding("text-embedding-3-small", 25);

    // Tagged-template calls arrive as (stringsArray, ...values) — check the
    // interpolated values include what we passed in, since asserting the
    // exact SQL string would be brittle.
    const values = mockedQueryRaw.mock.calls[0].slice(1);
    expect(values).toContain("text-embedding-3-small");
    expect(values).toContain(25);
  });
});

describe("saveEmbedding", () => {
  it("writes the vector as a pgvector literal alongside model/dimensions", async () => {
    mockedExecuteRaw.mockResolvedValue(1);

    await saveEmbedding("chunk_1", [0.1, 0.2, 0.3], "text-embedding-3-small", 3);

    const values = mockedExecuteRaw.mock.calls[0].slice(1);
    expect(values).toContain("[0.1,0.2,0.3]");
    expect(values).toContain("text-embedding-3-small");
    expect(values).toContain(3);
    expect(values).toContain("chunk_1");
  });
});
