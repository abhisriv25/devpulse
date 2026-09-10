import { logger } from "../logger.js";
import { GithubApiNotFoundError, fetchPullRequestFromGithub } from "../github/pull-request.service.js";
import { findRepositoryByGithubIds } from "../github/repository.service.js";
import {
  listReceivedWebhookEvents,
  markWebhookEventFailed,
  markWebhookEventIgnored,
  markWebhookEventProcessed,
} from "../webhooks/webhook-event.service.js";
import type { WebhookEventRecord } from "../webhooks/webhook.types.js";
import { upsertPullRequestFromGithub } from "./pull-request.repository.js";

/**
 * A `pull_request` webhook payload always includes `number` at the top
 * level (and redundantly on the nested `pull_request` object) — this reads
 * either without assuming a full GitHub payload shape, since
 * WebhookEvent.payload is stored as opaque JSON.
 */
function extractPullRequestNumber(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as { number?: unknown; pull_request?: { number?: unknown } };
  if (typeof p.number === "number") return p.number;
  if (typeof p.pull_request?.number === "number") return p.pull_request.number;
  return null;
}

/**
 * Consumes one RECEIVED WebhookEvent and turns it into current PullRequest
 * state. This is the "separate processor" half of the Slice 3/4 boundary —
 * webhook.routes.ts never calls into this module, and this module never
 * touches the HTTP layer. It's triggered only by the poller (or directly,
 * in tests).
 *
 * Deliberately fetches the PR from GitHub's API rather than trusting the
 * webhook payload's own PR fields: the webhook tells you *an event
 * happened*, GitHub's API tells you the *current* state, which is what you
 * actually want once a PR has changed multiple times before this got
 * around to processing it.
 */
export async function processWebhookEvent(event: WebhookEventRecord): Promise<void> {
  if (!event.githubRepoId || !event.githubInstallationId) {
    logger.warn({ eventId: event.id }, "Webhook event missing repo/installation id — marking FAILED");
    await markWebhookEventFailed(event.id);
    return;
  }

  const prNumber = extractPullRequestNumber(event.payload);
  if (prNumber === null) {
    logger.warn({ eventId: event.id }, "Could not extract a PR number from the webhook payload — marking FAILED");
    await markWebhookEventFailed(event.id);
    return;
  }

  const repository = await findRepositoryByGithubIds(event.githubRepoId, event.githubInstallationId);
  if (!repository) {
    // Not necessarily wrong — the repo may have been disconnected since
    // this event arrived, or this installation isn't one DevPulse tracks.
    // Nothing to retry, and nothing to alarm on.
    logger.info({ eventId: event.id }, "No connected Repository for this event — marking IGNORED");
    await markWebhookEventIgnored(event.id);
    return;
  }

  try {
    const githubPr = await fetchPullRequestFromGithub(
      event.githubInstallationId,
      repository.owner,
      repository.name,
      prNumber
    );
    await upsertPullRequestFromGithub(repository.id, githubPr);
    await markWebhookEventProcessed(event.id);
  } catch (err) {
    if (err instanceof GithubApiNotFoundError) {
      // Permanent: GitHub itself says this PR doesn't exist. Retrying
      // won't change that.
      logger.warn({ eventId: event.id, err }, "GitHub PR not found (404) — marking FAILED");
      await markWebhookEventFailed(event.id);
      return;
    }
    // Anything else (network blip, GitHub 5xx, rate limit) is presumed
    // transient: leave the event at RECEIVED, untouched, so the next poll
    // retries it rather than permanently giving up on a fixable failure.
    logger.error({ eventId: event.id, err }, "Transient failure processing webhook event — will retry");
  }
}

/** Pulls a batch of RECEIVED events and processes them one at a time.
 * Sequential on purpose — this is a small, simple processor, not a
 * parallel worker pool; correctness and readability matter more than
 * throughput at this slice. */
export async function processPendingWebhookEvents(limit = 25): Promise<{ processed: number }> {
  const events = await listReceivedWebhookEvents(limit);
  for (const event of events) {
    await processWebhookEvent(event);
  }
  return { processed: events.length };
}
