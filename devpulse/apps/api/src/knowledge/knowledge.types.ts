export interface KnowledgeSourceRecord {
  id: string;
  organizationId: string;
  repositoryId: string | null;
  sourceType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkMetadata {
  heading: string | null;
}

export interface DocumentChunkRecord {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: ChunkMetadata;
  createdAt: Date;
}

export interface DocumentRecord {
  id: string;
  knowledgeSourceId: string;
  path: string;
  title: string | null;
  content: string;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentWithChunks extends DocumentRecord {
  chunks: DocumentChunkRecord[];
}

/** One file's ingestion outcome — the orchestrator's per-file result before
 * being rolled up into a batch summary. */
export type FileIngestionOutcome =
  | { path: string; outcome: "ingested"; chunkCount: number }
  | { path: string; outcome: "skipped_unchanged" }
  | { path: string; outcome: "failed"; error: string };

export interface IngestRepositoryDocsResult {
  ingested: number;
  skipped: number;
  failed: number;
  files: FileIngestionOutcome[];
}
