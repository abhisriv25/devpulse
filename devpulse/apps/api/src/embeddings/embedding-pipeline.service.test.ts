import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./embedding-provider.js", () => ({
  generateEmbeddings: vi.fn(),
}));

vi.mock("./embedding.repository.js", () => ({
  findChunksNeedingEmbedding: vi.fn(),
  saveEmbedding: vi.fn(),
}));

import { generateEmbeddings } from "./embedding-provider.js";
import { findChunksNeedingEmbedding, saveEmbedding } from "./embedding.repository.js";
import { embedPendingChunks } from "./embedding-pipeline.service.js";

const mockedGenerate = vi.mocked(generateEmbeddings);
const mockedFindPending = vi.mocked(findChunksNeedingEmbedding);
const mockedSave = vi.mocked(saveEmbedding);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("embedPendingChunks", () => {
  it("does nothing and makes no provider call when there's nothing pending", async () => {
    mockedFindPending.mockResolvedValue([]);

    const result = await embedPendingChunks();

    expect(result).toEqual({ embedded: 0, failed: 0 });
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("embeds every pending chunk in one batch call and saves each result", async () => {
    mockedFindPending.mockResolvedValue([
      { id: "chunk_1", content: "first" },
      { id: "chunk_2", content: "second" },
    ]);
    mockedGenerate.mockResolvedValue({
      vectors: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
      model: "text-embedding-3-small",
      dimensions: 2,
    });
    mockedSave.mockResolvedValue(undefined);

    const result = await embedPendingChunks(10);

    expect(mockedGenerate).toHaveBeenCalledWith(["first", "second"]);
    expect(mockedSave).toHaveBeenCalledWith("chunk_1", [0.1, 0.2], "text-embedding-3-small", 2);
    expect(mockedSave).toHaveBeenCalledWith("chunk_2", [0.3, 0.4], "text-embedding-3-small", 2);
    expect(result).toEqual({ embedded: 2, failed: 0 });
  });

  it("isolates a per-chunk save failure — the rest of the batch still gets saved", async () => {
    mockedFindPending.mockResolvedValue([
      { id: "chunk_1", content: "first" },
      { id: "chunk_2", content: "second" },
    ]);
    mockedGenerate.mockResolvedValue({
      vectors: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
      model: "text-embedding-3-small",
      dimensions: 2,
    });
    mockedSave.mockRejectedValueOnce(new Error("DB write failed")).mockResolvedValueOnce(undefined);

    const result = await embedPendingChunks();

    expect(result).toEqual({ embedded: 1, failed: 1 });
  });

  it("fails the whole batch (without partial saves) when the provider call itself fails", async () => {
    mockedFindPending.mockResolvedValue([
      { id: "chunk_1", content: "first" },
      { id: "chunk_2", content: "second" },
    ]);
    mockedGenerate.mockRejectedValue(new Error("Embedding API down"));

    const result = await embedPendingChunks();

    expect(result).toEqual({ embedded: 0, failed: 2 });
    expect(mockedSave).not.toHaveBeenCalled();
  });
});
