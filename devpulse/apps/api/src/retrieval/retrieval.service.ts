import { generateEmbeddings } from "../embeddings/embedding-provider.js";
import { searchSimilarChunks } from "./retrieval.repository.js";
import type { RetrievedChunk, RetrieveRelevantContextParams } from "./retrieval.types.js";

const DEFAULT_TOP_K = 5;

/**
 * Bump when the retrieval *strategy* changes materially — a different
 * similarity metric, a minimum-similarity cutoff being added, a reranking
 * step, etc. Distinct from `embeddingModel` (which model produced the
 * vectors): this versions the search logic itself. Slice 10 stamps every
 * persisted `PRAnalysis` row with this, same reasoning as PROMPT_VERSION.
 */
export const RETRIEVAL_VERSION = "v1";

/**
 * Turns a natural-language question into the organization's most relevant
 * stored document chunks. Embeds the query with the same provider (and
 * therefore, in practice, the same model) used to embed the stored chunks
 * — comparing vectors from two different embedding models would produce
 * meaningless similarity scores, so this intentionally doesn't accept a
 * model override.
 *
 * Not exposed as an HTTP endpoint — per the design doc, a function is
 * enough until something (Slice 9's RAG layer) actually needs to call
 * this over the network.
 */
export async function retrieveRelevantContext(params: RetrieveRelevantContextParams): Promise<RetrievedChunk[]> {
  const { organizationId, query, topK = DEFAULT_TOP_K } = params;

  if (query.trim().length === 0) {
    return [];
  }

  const { vectors } = await generateEmbeddings([query]);
  return searchSimilarChunks(organizationId, vectors[0], topK);
}
