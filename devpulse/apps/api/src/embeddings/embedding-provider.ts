import { env } from "../config/env.js";
import type { EmbeddingBatchResult } from "./embedding.types.js";

interface OpenAiEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
}

/**
 * Calls an OpenAI-compatible `/embeddings` endpoint with every input text
 * in a single request — "batch where sensible" (the design doc's own
 * words) means one HTTP call for N chunks, not N calls.
 *
 * Deliberately doesn't hardcode the output vector's dimensionality: it's
 * read from the response itself (`vectors[0].length`), so switching to a
 * different model with a different output size needs no code change here
 * — see the `Unsupported("vector")` (no fixed size) column declaration in
 * schema.prisma for the other half of that decision.
 */
export async function generateEmbeddings(texts: string[]): Promise<EmbeddingBatchResult> {
  if (texts.length === 0) {
    return { vectors: [], model: env.EMBEDDING_MODEL, dimensions: 0 };
  }

  const response = await fetch(`${env.EMBEDDING_API_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.EMBEDDING_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: env.EMBEDDING_MODEL, input: texts }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API request failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenAiEmbeddingResponse;
  // The API doesn't guarantee response order matches request order — sort
  // by the index it echoes back rather than trusting array position.
  const vectors = [...data.data].sort((a, b) => a.index - b.index).map((entry) => entry.embedding);

  return {
    vectors,
    model: env.EMBEDDING_MODEL,
    dimensions: vectors[0]?.length ?? 0,
  };
}
