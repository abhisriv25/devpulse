import { createHmac } from "node:crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { buildApp } from "../app.js";

const SECRET = "test-webhook-secret"; // matches test/setup-env.ts

// Mock Prisma entirely — these tests exercise routing, signature
// verification, and dedupe *logic*, not a real database. The unique-
// constraint dedupe path is simulated by throwing a Prisma-shaped P2002
// error, same as a real unique violation would.
vi.mock("../db/client.js", () => ({
  prisma: {
    webhookEvent: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "../db/client.js";
const mockedCreate = vi.mocked(prisma.webhookEvent.create);

beforeEach(() => {
  vi.clearAllMocks();
});

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(Buffer.from(body, "utf8")).digest("hex");
}

function sendWebhook(
  app: ReturnType<typeof buildApp>,
  opts: {
    body: object;
    signature?: string | null; // null = omit header entirely; undefined = compute a valid one
    deliveryId?: string | null;
    eventType?: string | null;
  }
) {
  const bodyString = JSON.stringify(opts.body);
  const req = request(app).post("/webhooks/github").type("application/json");

  const signature = opts.signature === null ? undefined : (opts.signature ?? sign(bodyString));
  if (signature) req.set("X-Hub-Signature-256", signature);

  if (opts.deliveryId !== null) req.set("X-GitHub-Delivery", opts.deliveryId ?? "delivery-1");
  if (opts.eventType !== null) req.set("X-GitHub-Event", opts.eventType ?? "pull_request");

  return req.send(bodyString);
}

describe("POST /webhooks/github — signature verification", () => {
  it("accepts a validly signed request", async () => {
    const app = buildApp();
    mockedCreate.mockResolvedValue({} as never);

    const res = await sendWebhook(app, { body: { action: "opened" } });
    expect(res.status).toBe(202);
  });

  it("rejects a missing signature header", async () => {
    const app = buildApp();
    const res = await sendWebhook(app, { body: { action: "opened" }, signature: null });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_SIGNATURE");
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature", async () => {
    const app = buildApp();
    const res = await sendWebhook(app, { body: { action: "opened" }, signature: "sha256=deadbeef" });
    expect(res.status).toBe(401);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("rejects a body that was modified after signing", async () => {
    const app = buildApp();
    // Sign one payload, send a different one — simulates a tampered body.
    const signature = sign(JSON.stringify({ action: "opened" }));
    const res = await sendWebhook(app, { body: { action: "closed" }, signature });
    expect(res.status).toBe(401);
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

describe("POST /webhooks/github — validation", () => {
  it("rejects a request missing X-GitHub-Delivery", async () => {
    const app = buildApp();
    const res = await sendWebhook(app, { body: { action: "opened" }, deliveryId: null });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_WEBHOOK");
  });

  it("rejects a request missing X-GitHub-Event", async () => {
    const app = buildApp();
    const res = await sendWebhook(app, { body: { action: "opened" }, eventType: null });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_WEBHOOK");
  });
});

describe("POST /webhooks/github — persistence and idempotency", () => {
  it("stores a supported pull_request action as RECEIVED", async () => {
    const app = buildApp();
    mockedCreate.mockResolvedValue({} as never);

    const res = await sendWebhook(app, {
      body: { action: "opened", repository: { id: 555 }, installation: { id: 42 } },
      deliveryId: "d-1",
      eventType: "pull_request",
    });

    expect(res.status).toBe(202);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockedCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArgs.data).toMatchObject({
      deliveryId: "d-1",
      eventType: "pull_request",
      action: "opened",
      githubRepoId: "555",
      githubInstallationId: "42",
      status: "RECEIVED",
    });
  });

  it("stores an unsupported pull_request action as IGNORED, but still 2xx", async () => {
    const app = buildApp();
    mockedCreate.mockResolvedValue({} as never);

    const res = await sendWebhook(app, {
      body: { action: "labeled", repository: { id: 555 } },
      deliveryId: "d-2",
      eventType: "pull_request",
    });

    expect(res.status).toBe(202);
    const createArgs = mockedCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArgs.data.status).toBe("IGNORED");
  });

  it("stores an out-of-scope event type (e.g. ping) as IGNORED, but still 2xx", async () => {
    const app = buildApp();
    mockedCreate.mockResolvedValue({} as never);

    const res = await sendWebhook(app, {
      body: { zen: "Keep it logically awesome." },
      deliveryId: "d-3",
      eventType: "ping",
    });

    expect(res.status).toBe(202);
    const createArgs = mockedCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArgs.data.status).toBe("IGNORED");
  });

  it("treats a replayed delivery id as a harmless duplicate, not a second record", async () => {
    const app = buildApp();
    // Simulates the unique constraint on deliveryId rejecting the second insert.
    mockedCreate.mockRejectedValueOnce(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));

    const res = await sendWebhook(app, {
      body: { action: "opened" },
      deliveryId: "d-4",
      eventType: "pull_request",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("already_processed");
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 500 (so GitHub retries) on an unexpected DB failure", async () => {
    const app = buildApp();
    mockedCreate.mockRejectedValueOnce(new Error("connection refused"));

    const res = await sendWebhook(app, {
      body: { action: "opened" },
      deliveryId: "d-5",
      eventType: "pull_request",
    });

    expect(res.status).toBe(500);
  });
});
