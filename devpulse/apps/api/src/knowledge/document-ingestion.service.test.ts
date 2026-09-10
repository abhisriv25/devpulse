import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../github/docs.service.js", () => ({
  fetchRepositoryDefaultBranch: vi.fn(),
  listMarkdownFilePaths: vi.fn(),
  fetchFileContent: vi.fn(),
}));

vi.mock("../github/repository.service.js", () => ({
  findRepositoryById: vi.fn(),
}));

vi.mock("./document.repository.js", () => ({
  findOrCreateKnowledgeSource: vi.fn(),
  findDocumentByPath: vi.fn(),
  upsertDocumentWithChunks: vi.fn(),
}));

import { fetchFileContent, fetchRepositoryDefaultBranch, listMarkdownFilePaths } from "../github/docs.service.js";
import { findRepositoryById } from "../github/repository.service.js";
import {
  findDocumentByPath,
  findOrCreateKnowledgeSource,
  upsertDocumentWithChunks,
} from "./document.repository.js";
import { RepositoryNotFoundError, ingestRepositoryDocs } from "./document-ingestion.service.js";
import { hashContent } from "./content-hash.js";

const mockedFindRepo = vi.mocked(findRepositoryById);
const mockedDefaultBranch = vi.mocked(fetchRepositoryDefaultBranch);
const mockedListPaths = vi.mocked(listMarkdownFilePaths);
const mockedFetchContent = vi.mocked(fetchFileContent);
const mockedFindOrCreateSource = vi.mocked(findOrCreateKnowledgeSource);
const mockedFindDoc = vi.mocked(findDocumentByPath);
const mockedUpsertDoc = vi.mocked(upsertDocumentWithChunks);

const REPOSITORY = {
  id: "repo_1",
  organizationId: "org_1",
  githubInstallationId: "inst_1",
  githubRepoId: "555",
  owner: "acme",
  name: "widgets",
  fullName: "acme/widgets",
  private: false,
  connectedAt: new Date(),
  updatedAt: new Date(),
};

const KNOWLEDGE_SOURCE = {
  id: "source_1",
  organizationId: "org_1",
  repositoryId: "repo_1",
  sourceType: "repository_docs",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedFindRepo.mockResolvedValue(REPOSITORY as never);
  mockedFindOrCreateSource.mockResolvedValue(KNOWLEDGE_SOURCE as never);
  mockedDefaultBranch.mockResolvedValue("main");
  mockedUpsertDoc.mockResolvedValue({} as never);
});

describe("ingestRepositoryDocs", () => {
  it("throws RepositoryNotFoundError when the repository doesn't exist", async () => {
    mockedFindRepo.mockResolvedValue(null);
    await expect(ingestRepositoryDocs("repo_missing")).rejects.toThrow(RepositoryNotFoundError);
    expect(mockedFindOrCreateSource).not.toHaveBeenCalled();
  });

  it("ingests every listed file that's new", async () => {
    mockedListPaths.mockResolvedValue(["README.md", "docs/architecture.md"]);
    mockedFindDoc.mockResolvedValue(null); // no existing docs
    mockedFetchContent
      .mockResolvedValueOnce("# Readme\n\nHello.")
      .mockResolvedValueOnce("# Architecture\n\nDetails.");

    const result = await ingestRepositoryDocs("repo_1");

    expect(result.ingested).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockedUpsertDoc).toHaveBeenCalledTimes(2);
  });

  it("skips a file whose content hash matches the stored one, and doesn't rewrite its chunks", async () => {
    const content = "# Readme\n\nUnchanged.";
    mockedListPaths.mockResolvedValue(["README.md"]);
    mockedFetchContent.mockResolvedValue(content);
    mockedFindDoc.mockResolvedValue({
      id: "doc_1",
      knowledgeSourceId: "source_1",
      path: "README.md",
      title: "Readme",
      content,
      contentHash: hashContent(content),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await ingestRepositoryDocs("repo_1");

    expect(result.skipped).toBe(1);
    expect(result.ingested).toBe(0);
    expect(mockedUpsertDoc).not.toHaveBeenCalled();
  });

  it("reprocesses a file whose content hash has changed", async () => {
    const newContent = "# Readme\n\nUpdated content.";
    mockedListPaths.mockResolvedValue(["README.md"]);
    mockedFetchContent.mockResolvedValue(newContent);
    mockedFindDoc.mockResolvedValue({
      id: "doc_1",
      knowledgeSourceId: "source_1",
      path: "README.md",
      title: "Readme",
      content: "# Readme\n\nOld content.",
      contentHash: hashContent("# Readme\n\nOld content."),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await ingestRepositoryDocs("repo_1");

    expect(result.ingested).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockedUpsertDoc).toHaveBeenCalledTimes(1);
  });

  it("scopes the knowledge source to the repository's own organization", async () => {
    mockedListPaths.mockResolvedValue([]);
    await ingestRepositoryDocs("repo_1");
    expect(mockedFindOrCreateSource).toHaveBeenCalledWith("org_1", "repo_1", "repository_docs");
  });

  it("continues past a single file's failure and reports it, without aborting the batch", async () => {
    mockedListPaths.mockResolvedValue(["README.md", "docs/broken.md", "docs/fine.md"]);
    mockedFindDoc.mockResolvedValue(null);
    mockedFetchContent
      .mockResolvedValueOnce("# Readme\n\nok.")
      .mockRejectedValueOnce(new Error("GitHub API 500"))
      .mockResolvedValueOnce("# Fine\n\nok.");

    const result = await ingestRepositoryDocs("repo_1");

    expect(result.ingested).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.files.find((f) => f.path === "docs/broken.md")).toMatchObject({ outcome: "failed" });
  });

  it("handles an empty document — still ingests it, with zero chunks", async () => {
    mockedListPaths.mockResolvedValue(["docs/empty.md"]);
    mockedFindDoc.mockResolvedValue(null);
    mockedFetchContent.mockResolvedValue("");

    const result = await ingestRepositoryDocs("repo_1");

    expect(result.ingested).toBe(1);
    expect(mockedUpsertDoc).toHaveBeenCalledWith(
      "source_1",
      "docs/empty.md",
      null,
      "",
      expect.any(String),
      [] // zero chunks for empty content
    );
  });
});
