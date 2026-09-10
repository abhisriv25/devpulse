import { prisma } from "../db/client.js";
import type { MarkdownChunk } from "./markdown-chunker.js";
import type { DocumentRecord, DocumentWithChunks, KnowledgeSourceRecord } from "./knowledge.types.js";

/**
 * One KnowledgeSource per (org, repo, sourceType) — re-ingesting the same
 * repo finds and reuses the existing row rather than creating a duplicate
 * every run, via the schema's own unique constraint.
 */
export function findOrCreateKnowledgeSource(
  organizationId: string,
  repositoryId: string,
  sourceType: string
): Promise<KnowledgeSourceRecord> {
  return prisma.knowledgeSource.upsert({
    where: {
      organizationId_repositoryId_sourceType: { organizationId, repositoryId, sourceType },
    },
    update: {},
    create: { organizationId, repositoryId, sourceType },
  });
}

export function findDocumentByPath(knowledgeSourceId: string, path: string): Promise<DocumentRecord | null> {
  return prisma.document.findUnique({
    where: { knowledgeSourceId_path: { knowledgeSourceId, path } },
  });
}

/**
 * Writes a document and its chunks together, atomically: the chunk set is
 * fully replaced (deleted, then reinserted) rather than diffed, since a
 * changed document's chunk boundaries can shift completely (a single
 * inserted heading renumbers every chunk after it) — there's no cheap
 * partial update that's actually correct here, and this only runs when
 * `contentHash` has already confirmed the content changed at all.
 */
export async function upsertDocumentWithChunks(
  knowledgeSourceId: string,
  path: string,
  title: string | null,
  content: string,
  contentHash: string,
  chunks: MarkdownChunk[]
): Promise<DocumentWithChunks> {
  return prisma.$transaction(async (tx: typeof prisma) => {
    const document = await tx.document.upsert({
      where: { knowledgeSourceId_path: { knowledgeSourceId, path } },
      update: { title, content, contentHash },
      create: { knowledgeSourceId, path, title, content, contentHash },
    });

    await tx.documentChunk.deleteMany({ where: { documentId: document.id } });

    if (chunks.length > 0) {
      await tx.documentChunk.createMany({
        data: chunks.map((chunk, index) => ({
          documentId: document.id,
          chunkIndex: index,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          metadata: { heading: chunk.heading },
        })),
      });
    }

    const createdChunks = await tx.documentChunk.findMany({
      where: { documentId: document.id },
      orderBy: { chunkIndex: "asc" },
    });

    return { ...document, chunks: createdChunks };
  });
}

export function listDocumentsForKnowledgeSource(knowledgeSourceId: string): Promise<DocumentRecord[]> {
  return prisma.document.findMany({
    where: { knowledgeSourceId },
    orderBy: { path: "asc" },
  });
}
