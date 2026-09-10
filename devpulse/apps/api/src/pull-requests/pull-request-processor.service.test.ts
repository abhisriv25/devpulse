import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WebhookEventRecord } from "../webhooks/webhook.types.js";

vi.mock("../github/pull-request.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../github/pull-request.service.js")>();
  return {
    ...actual,
    fetchPullRequestFromGithub: vi.fn(),
  };
});

vi.mock("../github/repository.service.js", () => ({
  findRepositoryByGithubIds: vi.fn(),
}));

vi.mock("../webhooks/webhook-event.service.js", () => ({
  listReceivedWebhookEvents: vi.fn(),
  markWebhookEventProcessed: vi.fn(),
  markWebhookEventFailed: vi.fn(),
  markWebhookEventIgnored: vi.fn(),
}));

vi.mock("./pull-request.repository.js", () => ({
  upsertPullRequestFromGithub: vi.fn(),
}));

import { GithubApiNotFoundError, fetchPullRequestFromGithub } from "../github/pull-request.service.js";
import { findRepositoryByGithubIds } from "../github/repository.service.js";
import {
  listReceivedWebhookEvents,
  markWebhookEventFailed,
  markWebhookEventIgnored,
  markWebhookEventProcessed,
} from "../webhooks/webhook-event.service.js";
import { upsertPullRequestFromGithub } from "./pull-request.repository.js";
import { processPendingWebhookEvents, processWebhookEvent } from "./pull-request-processor.service.js";

const mockedFetch = vi.mocked(fetchPullRequestFromGithub);
const mockedFindRepo = vi.mocked(findRepositoryByGithubIds);
const mockedUpsert = vi.mocked(upsertPullRequestFromGithub);
const mockedListReceived = vi.mocked(listReceivedWebhookEvents);
const mockedMarkProcessed = vi.mocked(markWebhookEventProcessed);
const mockedMarkFailed = vi.mocked(markWebhookEventFailed);
const mockedMarkIgnored = vi.mocked(markWebhookEventIgnored);

const CONNECTED_REPO = {
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

function makeEvent(overrides: Partial<WebhookEventRecord> = {}): WebhookEventRecord {
  return {
    id: "event_1",
    deliveryId: "delivery_1",
    eventType: "pull_request",
    action: "opened",
    githubRepoId: "555",
    githubInstallationId: "inst_1",
    payload: { action: "opened", number: 42 },
    status: "RECEIVED",
    receivedAt: new Date(),
    processedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processWebhookEvent — happy path", () => {
  for (const action of ["opened", "reopened", "synchronize", "closed"] as const) {
    it(`fetches current PR state and marks the event PROCESSED for a ${action} event`, async () => {
      mockedFindRepo.mockResolvedValue(CONNECTED_REPO as never);
      const githubPr = { id: 999, number: 42 };
      mockedFetch.mockResolvedValue(githubPr as never);
      mockedUpsert.mockResolvedValue({} as never);

      await processWebhookEvent(makeEvent({ action, payload: { action, number: 42 } }));

      expect(mockedFetch).toHaveBeenCalledWith("inst_1", "acme", "widgets", 42);
      expect(mockedUpsert).toHaveBeenCalledWith("repo_1", githubPr);
      expect(mockedMarkProcessed).toHaveBeenCalledWith("event_1");
      expect(mockedMarkFailed).not.toHaveBeenCalled();
      expect(mockedMarkIgnored).not.toHaveBeenCalled();
    });
  }

  it("reads the PR number from the nested pull_request object when it's not present at the top level", async () => {
    mockedFindRepo.mockResolvedValue(CONNECTED_REPO as never);
    mockedFetch.mockResolvedValue({ id: 1 } as never);
    mockedUpsert.mockResolvedValue({} as never);

    await processWebhookEvent(makeEvent({ payload: { action: "opened", pull_request: { number: 77 } } }));

    expect(mockedFetch).toHaveBeenCalledWith("inst_1", "acme", "widgets", 77);
  });
});

describe("processWebhookEvent — unknown repo/installation", () => {
  it("marks the event IGNORED (not FAILED) when no connected Repository matches, and never calls GitHub", async () => {
    mockedFindRepo.mockResolvedValue(null);

    await processWebhookEvent(makeEvent());

    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(mockedMarkIgnored).toHaveBeenCalledWith("event_1");
    expect(mockedMarkFailed).not.toHaveBeenCalled();
    expect(mockedMarkProcessed).not.toHaveBeenCalled();
  });

  it("marks the event FAILED when it's missing the installation id needed to even look up a repo", async () => {
    await processWebhookEvent(makeEvent({ githubInstallationId: null }));

    expect(mockedFindRepo).not.toHaveBeenCalled();
    expect(mockedFetch).not.toHaveBeenCalled();
    expect(mockedMarkFailed).toHaveBeenCalledWith("event_1");
  });

  it("marks the event FAILED when it's missing the repo id", async () => {
    await processWebhookEvent(makeEvent({ githubRepoId: null }));

    expect(mockedFindRepo).not.toHaveBeenCalled();
    expect(mockedMarkFailed).toHaveBeenCalledWith("event_1");
  });

  it("marks the event FAILED when no PR number can be extracted from the payload", async () => {
    await processWebhookEvent(makeEvent({ payload: { action: "opened" } }));

    expect(mockedFindRepo).not.toHaveBeenCalled();
    expect(mockedMarkFailed).toHaveBeenCalledWith("event_1");
  });
});

describe("processWebhookEvent — GitHub API failures", () => {
  it("marks the event FAILED on a GitHub 404 (permanent — the PR doesn't exist)", async () => {
    mockedFindRepo.mockResolvedValue(CONNECTED_REPO as never);
    mockedFetch.mockRejectedValue(new GithubApiNotFoundError("not found"));

    await processWebhookEvent(makeEvent());

    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(mockedMarkFailed).toHaveBeenCalledWith("event_1");
    expect(mockedMarkProcessed).not.toHaveBeenCalled();
  });

  it("leaves the event untouched (retryable) on a transient GitHub API failure", async () => {
    mockedFindRepo.mockResolvedValue(CONNECTED_REPO as never);
    mockedFetch.mockRejectedValue(new Error("GitHub API 503"));

    await processWebhookEvent(makeEvent());

    expect(mockedUpsert).not.toHaveBeenCalled();
    expect(mockedMarkFailed).not.toHaveBeenCalled();
    expect(mockedMarkProcessed).not.toHaveBeenCalled();
    expect(mockedMarkIgnored).not.toHaveBeenCalled();
  });
});

describe("processPendingWebhookEvents", () => {
  it("processes every RECEIVED event returned and reports how many", async () => {
    mockedListReceived.mockResolvedValue([
      makeEvent({ id: "event_1" }),
      makeEvent({ id: "event_2", deliveryId: "delivery_2" }),
    ] as never);
    mockedFindRepo.mockResolvedValue(null); // simplest path: both get marked IGNORED

    const result = await processPendingWebhookEvents(10);

    expect(result).toEqual({ processed: 2 });
    expect(mockedMarkIgnored).toHaveBeenCalledWith("event_1");
    expect(mockedMarkIgnored).toHaveBeenCalledWith("event_2");
    expect(mockedListReceived).toHaveBeenCalledWith(10);
  });

  it("returns processed: 0 when there's nothing to do", async () => {
    mockedListReceived.mockResolvedValue([]);

    const result = await processPendingWebhookEvents();

    expect(result).toEqual({ processed: 0 });
  });
});
