export interface EmbeddingBatchResult {
  vectors: number[][];
  model: string;
  /** Read from the provider's actual response, not a hardcoded constant —
   * see embedding-provider.ts's doc comment on why. */
  dimensions: number;
}

/** A DocumentChunk row that still needs an embedding — either it's never
 * been embedded, or it was embedded with a since-changed model (see
 * embedding.repository.ts's findChunksNeedingEmbedding). */
export interface PendingChunk {
  id: string;
  content: string;
}
