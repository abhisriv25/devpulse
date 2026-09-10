/** The subset of a `pull_request` webhook payload Slice 3 actually reads.
 * Deliberately not a full GitHub payload type — we only touch what we
 * store or branch on; the complete payload is preserved as-is in
 * WebhookEvent.payload regardless. */
export interface GithubWebhookPayload {
  action?: string;
  repository?: {
    id: number;
  };
  installation?: {
    id: number;
  };
}

/** pull_request actions Slice 3 will eventually hand to a PR-sync worker
 * (Slice 4). Everything else is stored but marked IGNORED. */
export const SUPPORTED_PULL_REQUEST_ACTIONS = new Set(["opened", "reopened", "synchronize", "closed"]);

export const SUPPORTED_EVENT_TYPES = new Set(["pull_request"]);

/** Explicit return shape (rather than relying on Prisma's inferred payload
 * type) so callers type-check correctly even before `prisma generate` has
 * run — same reasoning as RepositoryRecord in github/repository.service.ts. */
export interface WebhookEventRecord {
  id: string;
  deliveryId: string;
  eventType: string;
  action: string | null;
  githubRepoId: string | null;
  githubInstallationId: string | null;
  payload: unknown;
  status: "RECEIVED" | "PROCESSED" | "FAILED" | "IGNORED";
  receivedAt: Date;
  processedAt: Date | null;
}
