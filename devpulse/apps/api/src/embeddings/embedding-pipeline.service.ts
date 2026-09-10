import { logger } from "../logger.js";
import { generateEmbeddings } from "./embedding-provider.js";
import { findChunksNeedingEmbedding, saveEmbedding } from "./embedding.repository.js";
import { env } from "../config/env.js";

export interface EmbedPendingChunksResult {
  embedded: number;
  failed: number;
}

/**
 * Finds chunks that need embedding work and embeds them in one batch API
 * call. This is the entire Slice 8 embedding pipeline: no scheduling, no
 * queue — same "callable service, not a wired-up trigger" pattern as
 * Slice 5's `assessPullRequest` and Slice 7's `ingestRepositoryDocs`.
 *
 * A whole-batch provider failure (the API call itself throwing — network
 * error, auth failure, rate limit) fails every chunk in this batch, since
 * there's nothing per-chunk to isolate: the request never got a response
 * to attribute per-item. A per-chunk *save* failure (the DB write for one
 * embedding) is isolated — the rest of the batch's embeddings still get
 * saved. Either way, nothing here ever touches `Document.content` or
 * `DocumentChunk.content` — an embedding failure can't corrupt the source
 * text it was trying to embed.
 */
export async function embedPendingChunks(limit = 50): Promise<EmbedPendingChunksResult> {
  const chunks = await findChunksNeedingEmbedding(env.EMBEDDING_MODEL, limit);
  if (chunks.length === 0) {
    return { embedded: 0, failed: 0 };
  }

  let batch;
  try {
    batch = await generateEmbeddings(chunks.map((chunk) => chunk.content));
  } catch (err) {
    logger.error({ err, chunkCount: chunks.length }, "Embedding API call failed for the whole batch");
    return { embedded: 0, failed: chunks.length };
  }

  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < chunks.length; i++) {
    try {
      await saveEmbedding(chunks[i].id, batch.vectors[i], batch.model, batch.dimensions);
      embedded++;
    } catch (err) {
      logger.error({ err, chunkId: chunks[i].id }, "Failed to save an embedding; continuing with the rest");
      failed++;
    }
  }

  return { embedded, failed };
}
