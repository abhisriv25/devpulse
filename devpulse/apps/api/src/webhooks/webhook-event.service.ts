import { prisma } from "../db/client.js";
import { SUPPORTED_EVENT_TYPES, SUPPORTED_PULL_REQUEST_ACTIONS } from "./webhook.types.js";
import type { GithubWebhookPayload, WebhookEventRecord } from "./webhook.types.js";

export interface PersistWebhookEventInput {
  deliveryId: string;
  eventType: string;
  /** The full, unparsed-by-us JSON payload GitHub sent — stored verbatim
   * (see WebhookEvent.payload doc comment in schema.prisma) so a future
   * processing bug can be diagnosed against the real event, not a
   * best-effort reconstruction of it. */
  payload: unknown;
}

export type PersistWebhookEventResult = { outcome: "created" } | { outcome: "duplicate" };

function readKnownFields(payload: unknown): GithubWebhookPayload {
  if (typeof payload !== "object" || payload === null) return {};
  return payload as GithubWebhookPayload;
}

/** True if this event/action is something a later slice's worker will
 * actually pick up. Deliberately narrow — see webhook.types.ts. Anything
 * else still gets stored (for the audit trail / future replay) but marked
 * IGNORED rather than RECEIVED. */
function isSupportedAction(eventType: string, action: string | undefined): boolean {
  if (!SUPPORTED_EVENT_TYPES.has(eventType)) return false;
  return action !== undefined && SUPPORTED_PULL_REQUEST_ACTIONS.has(action);
}

function isUniqueConstraintViolation(err: unknown): boolean {
  // Checking the Prisma error shape structurally (rather than importing
  // Prisma.PrismaClientKnownRequestError) keeps this file working whether
  // or not the generated client happens to be present when it's type-checked.
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/**
 * Persists a webhook delivery. Idempotency relies on the `deliveryId`
 * unique constraint doing the work — not a check-then-insert — because
 * that's the only thing safe under two concurrent requests for the same
 * delivery (a retry that overlaps the original): the database accepts
 * exactly one of two concurrent INSERTs with the same unique key, where a
 * SELECT-then-INSERT in application code has a race window.
 */
export async function persistWebhookEvent(input: PersistWebhookEventInput): Promise<PersistWebhookEventResult> {
  const { deliveryId, eventType, payload } = input;
  const { action, repository, installation } = readKnownFields(payload);

  try {
    await prisma.webhookEvent.create({
      data: {
        deliveryId,
        eventType,
        action: action ?? null,
        githubRepoId: repository ? String(repository.id) : null,
        githubInstallationId: installation ? String(installation.id) : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: payload as any,
        status: isSupportedAction(eventType, action) ? "RECEIVED" : "IGNORED",
      },
    });
    return { outcome: "created" };
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      return { outcome: "duplicate" };
    }
    throw err;
  }
}

/**
 * The Slice 4 processor's work queue: events stored as RECEIVED (i.e. a
 * supported pull_request action Slice 3 hasn't acted on yet), oldest
 * first. Not a real queue — see pull-requests/webhook-poller.ts — just the
 * read side of "what needs processing."
 */
export function listReceivedWebhookEvents(limit: number): Promise<WebhookEventRecord[]> {
  return prisma.webhookEvent.findMany({
    where: { status: "RECEIVED" },
    orderBy: { receivedAt: "asc" },
    take: limit,
  });
}

export function markWebhookEventProcessed(id: string) {
  return prisma.webhookEvent.update({
    where: { id },
    data: { status: "PROCESSED", processedAt: new Date() },
  });
}

export function markWebhookEventFailed(id: string) {
  return prisma.webhookEvent.update({
    where: { id },
    data: { status: "FAILED", processedAt: new Date() },
  });
}

export function markWebhookEventIgnored(id: string) {
  return prisma.webhookEvent.update({
    where: { id },
    data: { status: "IGNORED", processedAt: new Date() },
  });
}
