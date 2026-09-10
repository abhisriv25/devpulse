import { prisma } from "../db/client.js";
import { toPgVectorLiteral } from "./pgvector.js";
import type { PendingChunk } from "./embedding.types.js";

/**
 * Chunks that need embedding work: never embedded (`embedding IS NULL`),
 * or embedded with a model that's since changed (`embeddingModel` doesn't
 * match `currentModel`). That second condition is what "versions" model
 * upgrades — switching `EMBEDDING_MODEL` naturally re-queues every
 * existing chunk for re-embedding on the next pipeline run, with no
 * special-cased migration logic needed.
 *
 * Raw SQL because `embedding` is an `Unsupported` Prisma field — the
 * generated client has no typed way to query or read it.
 */
export async function findChunksNeedingEmbedding(currentModel: string, limit: number): Promise<PendingChunk[]> {
  return prisma.$queryRaw<PendingChunk[]>`
    SELECT id, content
    FROM "DocumentChunk"
    WHERE embedding IS NULL OR "embeddingModel" IS DISTINCT FROM ${currentModel}
    ORDER BY "createdAt" ASC
    LIMIT ${limit}
  `;
}

/**
 * Writes one chunk's embedding. Always all four columns together
 * (vector + model + dimensions + timestamp) — a partially-written
 * embedding (e.g. a vector with no matching model recorded) would be
 * worse than no embedding at all, since findChunksNeedingEmbedding
 * couldn't tell it apart from a valid one.
 */
export async function saveEmbedding(
  chunkId: string,
  vector: number[],
  model: string,
  dimensions: number
): Promise<void> {
  const literal = toPgVectorLiteral(vector);
  await prisma.$executeRaw`
    UPDATE "DocumentChunk"
    SET embedding = ${literal}::vector,
        "embeddingModel" = ${model},
        "embeddingDimensions" = ${dimensions},
        "embeddedAt" = now()
    WHERE id = ${chunkId}
  `;
}
