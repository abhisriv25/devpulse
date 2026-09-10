import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateEmbeddings } from "./embedding-provider.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("generateEmbeddings", () => {
  it("returns immediately without a network call for an empty input list", async () => {
    const result = await generateEmbeddings([]);
    expect(result).toEqual({ vectors: [], model: "text-embedding-3-small", dimensions: 0 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("sends every text in a single batched request", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({
        data: [
          { embedding: [0.1, 0.2], index: 0 },
          { embedding: [0.3, 0.4], index: 1 },
        ],
      })
    );

    await generateEmbeddings(["first chunk", "second chunk"]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.input).toEqual(["first chunk", "second chunk"]);
  });

  it("reorders vectors by the response's own index rather than trusting array position", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({
        data: [
          { embedding: [9, 9], index: 1 }, // out of order on purpose
          { embedding: [1, 1], index: 0 },
        ],
      })
    );

    const result = await generateEmbeddings(["a", "b"]);
    expect(result.vectors).toEqual([
      [1, 1],
      [9, 9],
    ]);
  });

  it("derives dimensions from the actual response, not a hardcoded constant", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ data: [{ embedding: [1, 2, 3, 4, 5], index: 0 }] })
    );

    const result = await generateEmbeddings(["a"]);
    expect(result.dimensions).toBe(5);
  });

  it("throws on a non-2xx response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(generateEmbeddings(["a"])).rejects.toThrow(/401/);
  });
});
