import { prisma } from "../db/client.js";
import { toPgVectorLiteral } from "../embeddings/pgvector.js";
import type { RetrievedChunk } from "./retrieval.types.js";

interface RawSimilarChunkRow {
  chunkId: string;
  documentId: string;
  content: string;
  metadata: { heading: string | null } | null;
  path: string;
  title: string | null;
  similarity: number;
}

/**
 * The organization filter is part of the query itself — joined all the
 * way from DocumentChunk through Document to KnowledgeSource.organizationId
 * — not applied afterward to a broader result set. That's deliberate: per
 * the design doc, tenant isolation is part of retrieval *correctness*, not
 * a post-filter that could be forgotten by a future caller. There is no
 * code path in this function that can return another organization's data,
 * structurally, regardless of what the caller passes as `query`.
 *
 * Only chunks with an embedding are considered (`embedding IS NOT NULL`)
 * — a document that's been chunked (Slice 7) but not yet embedded (Slice 8
 * hasn't gotten to it) is silently excluded rather than erroring, since
 * "not yet embedded" is an expected, transient state, not a bug.
 */
export async function searchSimilarChunks(
  organizationId: string,
  queryVector: number[],
  topK: number
): Promise<RetrievedChunk[]> {
  const literal = toPgVectorLiteral(queryVector);

  const rows = await prisma.$queryRaw<RawSimilarChunkRow[]>`
    SELECT
      dc.id AS "chunkId",
      dc."documentId" AS "documentId",
      dc.content AS content,
      dc.metadata AS metadata,
      d.path AS path,
      d.title AS title,
      1 - (dc.embedding <=> ${literal}::vector) AS similarity
    FROM "DocumentChunk" dc
    JOIN "Document" d ON d.id = dc."documentId"
    JOIN "KnowledgeSource" ks ON ks.id = d."knowledgeSourceId"
    WHERE ks."organizationId" = ${organizationId}
      AND dc.embedding IS NOT NULL
    ORDER BY dc.embedding <=> ${literal}::vector ASC
    LIMIT ${topK}
  `;

  return rows.map((row: RawSimilarChunkRow) => ({
    chunkId: row.chunkId,
    documentId: row.documentId,
    content: row.content,
    heading: row.metadata?.heading ?? null,
    path: row.path,
    title: row.title,
    similarity: row.similarity,
  }));
}
