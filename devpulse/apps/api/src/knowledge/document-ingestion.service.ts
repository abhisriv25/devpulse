import { fetchFileContent, fetchRepositoryDefaultBranch, listMarkdownFilePaths } from "../github/docs.service.js";
import { findRepositoryById } from "../github/repository.service.js";
import { logger } from "../logger.js";
import { hashContent } from "./content-hash.js";
import { findDocumentByPath, findOrCreateKnowledgeSource, upsertDocumentWithChunks } from "./document.repository.js";
import { chunkMarkdown, extractTitle } from "./markdown-chunker.js";
import type { FileIngestionOutcome, IngestRepositoryDocsResult } from "./knowledge.types.js";

export class RepositoryNotFoundError extends Error {}

const SOURCE_TYPE_REPOSITORY_DOCS = "repository_docs";

/**
 * Ingests a connected repo's README + docs/**\/*.md into ordered, hashed,
 * chunked storage. No embeddings, no vector search, no LLM calls — that's
 * Slice 8+. This slice's entire job is: fetch, hash, chunk, store, and
 * skip re-work when nothing changed.
 *
 * One bad file (a fetch failure, say) doesn't abort the whole run — it's
 * recorded as `failed` in the per-file results and everything else still
 * gets ingested. A partial, mostly-successful ingestion is more useful
 * than an all-or-nothing one that a single flaky file can block entirely.
 */
export async function ingestRepositoryDocs(repositoryId: string): Promise<IngestRepositoryDocsResult> {
  const repository = await findRepositoryById(repositoryId);
  if (!repository) {
    throw new RepositoryNotFoundError(`Repository ${repositoryId} not found`);
  }

  const knowledgeSource = await findOrCreateKnowledgeSource(
    repository.organizationId,
    repository.id,
    SOURCE_TYPE_REPOSITORY_DOCS
  );

  const branch = await fetchRepositoryDefaultBranch(repository.githubInstallationId, repository.owner, repository.name);
  const paths = await listMarkdownFilePaths(repository.githubInstallationId, repository.owner, repository.name, branch);

  const files: FileIngestionOutcome[] = [];

  for (const path of paths) {
    try {
      const content = await fetchFileContent(repository.githubInstallationId, repository.owner, repository.name, path, branch);
      const contentHash = hashContent(content);

      const existing = await findDocumentByPath(knowledgeSource.id, path);
      if (existing && existing.contentHash === contentHash) {
        files.push({ path, outcome: "skipped_unchanged" });
        continue;
      }

      const chunks = chunkMarkdown(content);
      const title = extractTitle(content);
      await upsertDocumentWithChunks(knowledgeSource.id, path, title, content, contentHash, chunks);
      files.push({ path, outcome: "ingested", chunkCount: chunks.length });
    } catch (err) {
      logger.error({ err, repositoryId, path }, "Failed to ingest a document; continuing with the rest");
      files.push({ path, outcome: "failed", error: err instanceof Error ? err.message : String(err) });
    }
  }

  return {
    ingested: files.filter((f) => f.outcome === "ingested").length,
    skipped: files.filter((f) => f.outcome === "skipped_unchanged").length,
    failed: files.filter((f) => f.outcome === "failed").length,
    files,
  };
}
