export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  /** From the chunk's own metadata — which Markdown section it came from,
   * if any. Carried through so a citation can say more than just "some
   * chunk of some file." */
  heading: string | null;
  path: string;
  title: string | null;
  /** Cosine similarity, 1 (identical) to -1 (opposite) in theory; in
   * practice for real text embeddings this lands roughly in [0, 1]. Higher
   * is more relevant. */
  similarity: number;
}

export interface RetrieveRelevantContextParams {
  organizationId: string;
  query: string;
  topK?: number;
}
